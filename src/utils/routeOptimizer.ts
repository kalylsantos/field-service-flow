import { ServiceOrder } from '@/types';

export interface OrderWithCoords extends ServiceOrder {
  client_lat: number;
  client_long: number;
}

export interface TechnicianRoute {
  technicianId: string;
  orders: OrderWithCoords[];
}

export interface OptimizationResult {
  routes: TechnicianRoute[];
  unassignedOrders: ServiceOrder[];
  totalOptimized: number;
}

/**
 * Calculates the Haversine distance between two points in kilometers
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates the centroid of a set of coordinates
 */
export function calculateCentroid(orders: OrderWithCoords[]): { lat: number; lon: number } {
  if (orders.length === 0) {
    return { lat: 0, lon: 0 };
  }
  
  const sumLat = orders.reduce((sum, o) => sum + o.client_lat, 0);
  const sumLon = orders.reduce((sum, o) => sum + o.client_long, 0);
  
  return {
    lat: sumLat / orders.length,
    lon: sumLon / orders.length,
  };
}

/**
 * Calculates the polar angle of a point relative to a centroid
 */
export function calculatePolarAngle(
  lat: number, lon: number,
  centroidLat: number, centroidLon: number
): number {
  // Use relative coordinates for angle calculation
  const dx = lon - centroidLon;
  const dy = lat - centroidLat;
  return Math.atan2(dy, dx);
}

/**
 * Angular Sweep: Divides orders into N clusters based on polar angles
 */
export function angularSweepCluster(
  orders: OrderWithCoords[],
  numClusters: number
): OrderWithCoords[][] {
  if (orders.length === 0 || numClusters <= 0) {
    return [];
  }
  
  if (numClusters === 1) {
    return [orders];
  }
  
  // Calculate centroid
  const centroid = calculateCentroid(orders);
  console.log(`Centroid: ${centroid.lat}, ${centroid.lon}`);
  
  // Calculate polar angle for each order
  const ordersWithAngles = orders.map(order => ({
    order,
    angle: calculatePolarAngle(
      order.client_lat, order.client_long,
      centroid.lat, centroid.lon
    ),
  }));
  
  // Sort by polar angle (-PI to +PI)
  ordersWithAngles.sort((a, b) => a.angle - b.angle);
  
  // Divide into N equal chunks
  const clusters: OrderWithCoords[][] = [];
  const chunkSize = Math.ceil(ordersWithAngles.length / numClusters);
  
  for (let i = 0; i < numClusters; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, ordersWithAngles.length);
    const chunk = ordersWithAngles.slice(start, end).map(item => item.order);
    
    if (chunk.length > 0) {
      clusters.push(chunk);
    }
  }
  
  console.log(`Created ${clusters.length} clusters: ${clusters.map(c => c.length).join(', ')}`);
  
  return clusters;
}

/**
 * Greedy Nearest Neighbor: Orders points by visiting the nearest unvisited point
 */
export function nearestNeighborSort(orders: OrderWithCoords[]): OrderWithCoords[] {
  if (orders.length <= 1) {
    return orders;
  }
  
  const sorted: OrderWithCoords[] = [];
  const remaining = [...orders];
  
  // Start with the first point (could also start from a depot location)
  sorted.push(remaining.shift()!);
  
  while (remaining.length > 0) {
    const lastPoint = sorted[sorted.length - 1];
    
    // Find nearest neighbor
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineDistance(
        lastPoint.client_lat, lastPoint.client_long,
        remaining[i].client_lat, remaining[i].client_long
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    
    // Move nearest to sorted list
    sorted.push(remaining.splice(nearestIndex, 1)[0]);
  }
  
  return sorted;
}

/**
 * Main optimization function: Angular Sweep + Nearest Neighbor
 */
export function optimizeRoutes(
  orders: ServiceOrder[],
  technicianIds: string[]
): OptimizationResult {
  console.log(`Optimizing ${orders.length} orders for ${technicianIds.length} technicians`);
  
  // Filter orders with valid coordinates
  const ordersWithCoords: OrderWithCoords[] = orders.filter(
    order => order.client_lat && order.client_long && 
             order.client_lat !== 0 && order.client_long !== 0
  ) as OrderWithCoords[];
  
  const unassignedOrders = orders.filter(
    order => !order.client_lat || !order.client_long ||
             order.client_lat === 0 || order.client_long === 0
  );
  
  if (unassignedOrders.length > 0) {
    console.warn(`${unassignedOrders.length} orders without coordinates will be skipped`);
  }
  
  if (ordersWithCoords.length === 0 || technicianIds.length === 0) {
    return {
      routes: [],
      unassignedOrders: orders,
      totalOptimized: 0,
    };
  }
  
  // Step 1: Angular Sweep clustering
  const clusters = angularSweepCluster(ordersWithCoords, technicianIds.length);
  
  // Step 2: Apply Nearest Neighbor to each cluster
  const routes: TechnicianRoute[] = technicianIds.map((technicianId, index) => {
    const clusterOrders = clusters[index] || [];
    const optimizedOrders = nearestNeighborSort(clusterOrders);
    
    console.log(`Technician ${technicianId}: ${optimizedOrders.length} orders`);
    
    return {
      technicianId,
      orders: optimizedOrders,
    };
  });
  
  const totalOptimized = routes.reduce((sum, route) => sum + route.orders.length, 0);
  
  return {
    routes,
    unassignedOrders,
    totalOptimized,
  };
}

/**
 * Calculates total route distance for a set of orders
 */
export function calculateRouteDistance(orders: OrderWithCoords[]): number {
  if (orders.length <= 1) return 0;
  
  let totalDistance = 0;
  
  for (let i = 0; i < orders.length - 1; i++) {
    totalDistance += haversineDistance(
      orders[i].client_lat, orders[i].client_long,
      orders[i + 1].client_lat, orders[i + 1].client_long
    );
  }
  
  return totalDistance;
}

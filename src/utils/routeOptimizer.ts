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
 * K-Means Clustering: Groups orders into k compact clusters
 */
export function kMeansCluster(
  orders: OrderWithCoords[],
  k: number,
  maxIterations = 50
): OrderWithCoords[][] {
  if (orders.length === 0 || k <= 0) return [];
  if (k >= orders.length) return orders.map(o => [o]);
  if (k === 1) return [orders];

  // 1. Initialize centroids randomly
  let centroids = getRandomCentroids(orders, k);
  let assignments: number[] = new Array(orders.length).fill(-1);
  let clusters: OrderWithCoords[][] = Array.from({ length: k }, () => []);
  let hasChanged = true;
  let iterations = 0;

  while (hasChanged && iterations < maxIterations) {
    hasChanged = false;
    clusters = Array.from({ length: k }, () => []);

    // 2. Assign each order to the nearest centroid
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      let minDistance = Infinity;
      let closestCentroidIndex = 0;

      for (let j = 0; j < k; j++) {
        const dist = haversineDistance(
          order.client_lat, order.client_long,
          centroids[j].lat, centroids[j].lon
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestCentroidIndex = j;
        }
      }

      if (assignments[i] !== closestCentroidIndex) {
        assignments[i] = closestCentroidIndex;
        hasChanged = true;
      }
      clusters[closestCentroidIndex].push(order);
    }

    // 3. Re-calculate centroids
    for (let j = 0; j < k; j++) {
      if (clusters[j].length > 0) {
        centroids[j] = calculateCentroid(clusters[j]);
      } else {
        // Handle empty cluster by re-initializing randomly
        const randomOrder = orders[Math.floor(Math.random() * orders.length)];
        centroids[j] = { lat: randomOrder.client_lat, lon: randomOrder.client_long };
      }
    }

    iterations++;
  }

  console.log(`K-Means converged in ${iterations} iterations.`);
  return clusters;
}

function getRandomCentroids(orders: OrderWithCoords[], k: number): { lat: number; lon: number }[] {
  // Simple random initialization
  const shuffled = [...orders].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, k).map(o => ({ lat: o.client_lat, lon: o.client_long }));
}


/**
 * 2-Opt Local Search: Optimizes a route by uncrossing paths
 */
export function twoOptOptimize(orders: OrderWithCoords[]): OrderWithCoords[] {
  if (orders.length <= 3) return orders;

  const route = [...orders];
  let improvement = true;
  const maxIterations = 100; // Limit to prevent freezing on large datasets
  let iterations = 0;

  while (improvement && iterations < maxIterations) {
    improvement = false;

    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length - 1; j++) { // -1 because we don't wrap around to start
        // Current edges: (i -> i+1) and (j -> j+1)
        // Proposed edges: (i -> j) and (i+1 -> j+1)
        // Note: essentially reversing the segment between i+1 and j

        const currentDistance =
          haversineDistance(route[i].client_lat, route[i].client_long, route[i + 1].client_lat, route[i + 1].client_long) +
          haversineDistance(route[j].client_lat, route[j].client_long, route[j + 1].client_lat, route[j + 1].client_long);

        const newDistance =
          haversineDistance(route[i].client_lat, route[i].client_long, route[j].client_lat, route[j].client_long) +
          haversineDistance(route[i + 1].client_lat, route[i + 1].client_long, route[j + 1].client_lat, route[j + 1].client_long);

        if (newDistance < currentDistance) {
          // Apply 2-opt swap: reverse segment from i+1 to j
          const segment = route.slice(i + 1, j + 1).reverse();
          route.splice(i + 1, segment.length, ...segment);
          improvement = true;
        }
      }
    }
    iterations++;
  }

  return route;
}

/**
 * Greedy Nearest Neighbor: Initial sort
 */
export function nearestNeighborSort(orders: OrderWithCoords[]): OrderWithCoords[] {
  if (orders.length <= 1) return orders;

  const sorted: OrderWithCoords[] = [];
  const remaining = [...orders];

  // Start with the northernmost point (heuristic to align "top-down")
  remaining.sort((a, b) => b.client_lat - a.client_lat);
  sorted.push(remaining.shift()!);

  while (remaining.length > 0) {
    const lastPoint = sorted[sorted.length - 1];
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
    sorted.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return sorted;
}

/**
 * Main optimization function: K-Means + Nearest Neighbor + 2-Opt
 */
export function optimizeRoutes(
  orders: ServiceOrder[],
  technicianIds: string[]
): OptimizationResult {
  console.log(`Optimizing ${orders.length} orders for ${technicianIds.length} technicians`);

  const ordersWithCoords: OrderWithCoords[] = orders.filter(
    order => order.client_lat && order.client_long &&
      order.client_lat !== 0 && order.client_long !== 0
  ) as OrderWithCoords[];

  const unassignedOrders = orders.filter(
    order => !order.client_lat || !order.client_long ||
      order.client_lat === 0 || order.client_long === 0
  );

  if (ordersWithCoords.length === 0 || technicianIds.length === 0) {
    return { routes: [], unassignedOrders: orders, totalOptimized: 0 };
  }

  // Step 1: K-Means Clustering
  // Groups points that are close to each other regardless of angle
  const clusters = kMeansCluster(ordersWithCoords, technicianIds.length);

  // Step 2 & 3: Route Construction & Optimization per cluster
  const routes: TechnicianRoute[] = technicianIds.map((technicianId, index) => {
    // Some clusters might be empty if K is large relative to N, or due to random init
    const clusterOrders = clusters[index] || [];

    if (clusterOrders.length === 0) {
      return { technicianId, orders: [] };
    }

    // Step 2: Nearest Neighbor (Construction Heuristic)
    const initialRoute = nearestNeighborSort(clusterOrders);

    // Step 3: 2-Opt (Improvement Heuristic)
    const optimizedOrders = twoOptOptimize(initialRoute);

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

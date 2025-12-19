import { ServiceOrder } from '@/types';

export interface GeocodingResult {
  lat: number;
  lon: number;
}

export interface GeocodingProgress {
  current: number;
  total: number;
  currentAddress: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_DELAY = 1500; // 1.5 seconds between requests

/**
 * Delays execution for specified milliseconds
 */
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Normalizes address by expanding common abbreviations
 */
function normalizeAddress(address: string): string {
  if (!address) return '';
  
  return address
    .replace(/^R\.\s*/i, 'Rua ')
    .replace(/^AV\.\s*/i, 'Avenida ')
    .replace(/^B\.\s*/i, 'Beco ')
    .replace(/^VIA\s*/i, 'Via ')
    .replace(/^TV\.\s*/i, 'Travessa ')
    .replace(/^JORN\s*/i, 'Jornalista ')
    .replace(/^DEP\s*/i, 'Deputado ')
    .replace(/^DR\.\s*/i, 'Doutor ')
    .replace(/^PROF\.\s*/i, 'Professor ')
    .replace(/^SEN\.\s*/i, 'Senador ')
    .replace(/^VER\.\s*/i, 'Vereador ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a query string from order address components
 */
export function buildAddressQuery(order: ServiceOrder): string {
  const parts = [
    normalizeAddress(order.address || ''),
    order.number,
    order.neighborhood,
    order.municipality,
    'Brasil'
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Builds alternative query formats for fallback attempts
 */
function buildAlternativeQueries(order: ServiceOrder): string[] {
  const queries: string[] = [];
  
  // Try without street number
  queries.push([
    normalizeAddress(order.address || ''),
    order.neighborhood,
    order.municipality,
    'Brasil'
  ].filter(Boolean).join(', '));
  
  // Try just neighborhood and city
  queries.push([
    order.neighborhood,
    order.municipality,
    'Santa Catarina',
    'Brasil'
  ].filter(Boolean).join(', '));
  
  return queries;
}

/**
 * Geocodes a single address using Nominatim API
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `${NOMINATIM_URL}?q=${encodedQuery}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FieldServiceManagement/1.0 (lovable.dev)',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`Nominatim error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Geocodes a single address with fallback attempts
 */
async function geocodeWithFallback(order: ServiceOrder): Promise<GeocodingResult | null> {
  // Try primary query first
  const primaryQuery = buildAddressQuery(order);
  let result = await geocodeAddress(primaryQuery);
  
  if (result) return result;
  
  // Try alternative queries
  const alternatives = buildAlternativeQueries(order);
  for (const query of alternatives) {
    await delay(RATE_LIMIT_DELAY);
    result = await geocodeAddress(query);
    if (result) {
      console.log(`Fallback geocoding succeeded for ${order.id} with query: ${query}`);
      return result;
    }
  }
  
  return null;
}

/**
 * Geocodes multiple orders with rate limiting
 * Returns orders with updated coordinates
 */
export async function geocodeOrders(
  orders: ServiceOrder[],
  onProgress?: (progress: GeocodingProgress) => void
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  
  // Filter orders that need geocoding (no coordinates or invalid ones)
  const ordersToGeocode = orders.filter(
    order => !order.client_lat || !order.client_long || 
             order.client_lat === 0 || order.client_long === 0
  );
  
  console.log(`Geocoding ${ordersToGeocode.length} orders of ${orders.length} total`);
  
  for (let i = 0; i < ordersToGeocode.length; i++) {
    const order = ordersToGeocode[i];
    const query = buildAddressQuery(order);
    
    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: ordersToGeocode.length,
        currentAddress: query,
      });
    }
    
    // Apply rate limiting delay (except for first request)
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
    
    // Try geocoding with fallback
    const result = await geocodeWithFallback(order);
    
    if (result) {
      results.set(order.id, result);
      console.log(`Geocoded ${order.id}: ${result.lat}, ${result.lon}`);
    } else {
      console.warn(`Failed to geocode order ${order.id}: ${query}`);
    }
  }
  
  return results;
}

/**
 * Checks if an order has valid coordinates
 */
export function hasValidCoordinates(order: ServiceOrder): boolean {
  return !!(
    order.client_lat && 
    order.client_long && 
    order.client_lat !== 0 && 
    order.client_long !== 0
  );
}

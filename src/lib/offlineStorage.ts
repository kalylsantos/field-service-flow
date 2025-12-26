import { Filesystem, Directory } from '@capacitor/filesystem';

const OFFLINE_TASKS_KEY = 'field_service_offline_tasks';

export interface OfflinePhoto {
    id: string;
    orderId: string;
    sequencial: string;
    uri: string; // Capacitor local URI
    blob?: Blob; // Temporary during capture
    taken_at: string;
    gps_lat?: number;
    gps_long?: number;
    isUploaded: boolean;
    order_index: number;
}

export interface OfflineTaskUpdate {
    orderId: string;
    data: any;
    status: 'pending' | 'syncing' | 'synced';
    timestamp: string;
}

/**
 * Saves a photo file to the device's persistent filesystem.
 */
export async function savePhotoToFilesystem(
    orderSequencial: string,
    fileName: string,
    blob: Blob
): Promise<string> {
    const base64Data = await blobToBase64(blob);
    const path = `order_photos/${orderSequencial}/${fileName}`;

    // Ensure directory exists
    try {
        await Filesystem.mkdir({
            path: `order_photos/${orderSequencial}`,
            directory: Directory.Data,
            recursive: true,
        });
    } catch (e) {
        // Directory might already exist
    }

    const result = await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: Directory.Data,
    });

    return result.uri;
}

/**
 * Reads a photo file from the device's persistent filesystem.
 */
export async function readPhotoFromFilesystem(uri: string): Promise<string> {
    const contents = await Filesystem.readFile({
        path: uri,
    });
    return `data:image/jpeg;base64,${contents.data}`;
}

/**
 * Gets all offline tasks from localStorage.
 */
export function getOfflineTasks(): OfflineTaskUpdate[] {
    const data = localStorage.getItem(OFFLINE_TASKS_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * Adds or updates a task in offline storage.
 */
export function saveOfflineTask(task: OfflineTaskUpdate) {
    const tasks = getOfflineTasks();
    const index = tasks.findIndex(t => t.orderId === task.orderId);

    if (index >= 0) {
        tasks[index] = task;
    } else {
        tasks.push(task);
    }

    localStorage.setItem(OFFLINE_TASKS_KEY, JSON.stringify(tasks));
}

/**
 * Removes a task from offline storage after sync.
 */
export function removeOfflineTask(orderId: string) {
    const tasks = getOfflineTasks().filter(t => t.orderId !== orderId);
    localStorage.setItem(OFFLINE_TASKS_KEY, JSON.stringify(tasks));
}

// Helper to convert Blob to Base64
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.split(',')[1]); // Remove data:image/jpeg;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

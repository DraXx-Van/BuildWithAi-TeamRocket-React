/**
 * ── Floor Plan Admin Service ──────────────────────────────────────────────────
 * Handles floor plan image upload + coordinate mapping for dynamic hotels.
 * 
 * Storage: Firestore (base64 data URL) — avoids Firebase Storage CORS issues
 * Database: Firestore → hotels/{hotelId}/floors/level_{n}
 *                      → hotels/{hotelId}/floors/level_{n}/rooms/{roomId}
 *
 * Flow:
 *   1. Hotel admin uploads image → converted to base64 data URL, saved in Firestore
 *   2. Admin clicks on image to place rooms → coordinates saved as % values
 *   3. Frontend renders markers based on those % values on top of the image
 */

import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER — Convert a File to a compressed base64 data URL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compress and convert an image File to a base64 data URL.
 * Resizes to max 1200px on the longest side and uses JPEG at 0.7 quality
 * to keep the Firestore document under ~1 MB.
 */
function fileToBase64(imageFile, maxDimension = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        // Determine scaled dimensions
        let w = img.width;
        let h = img.height;
        if (w > maxDimension || h > maxDimension) {
          const scale = maxDimension / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        // Draw onto canvas and export as JPEG
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(imageFile);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. IMAGE UPLOAD — Stores as base64 in Firestore (no Firebase Storage needed)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload a floor plan image by converting to base64 and saving to Firestore.
 * @param {string} hotelId — Unique identifier for the hotel
 * @param {number|string} floorLevel — e.g. 0, 1, 2...
 * @param {File} imageFile — The image File object from <input type="file">
 * @returns {Promise<{url: string}>}
 */
export async function uploadFloorPlanImage(hotelId, floorLevel, imageFile) {
  console.log(`[FP-ADMIN] Converting floor plan image to base64...`);
  const dataUrl = await fileToBase64(imageFile);

  // Check size — Firestore doc limit is ~1 MB
  const sizeKB = Math.round(dataUrl.length / 1024);
  console.log(`[FP-ADMIN] Compressed image size: ${sizeKB} KB`);
  if (dataUrl.length > 950_000) {
    // Re-compress at lower quality
    console.warn('[FP-ADMIN] Image too large, recompressing at lower quality...');
    const smallerDataUrl = await fileToBase64(imageFile, 800, 0.5);
    const smallerSizeKB = Math.round(smallerDataUrl.length / 1024);
    console.log(`[FP-ADMIN] Recompressed image size: ${smallerSizeKB} KB`);
    if (smallerDataUrl.length > 950_000) {
      throw new Error(`Image is too large even after compression (${smallerSizeKB} KB). Use a smaller image.`);
    }
    return saveFloorImage(hotelId, floorLevel, smallerDataUrl);
  }

  return saveFloorImage(hotelId, floorLevel, dataUrl);
}

async function saveFloorImage(hotelId, floorLevel, dataUrl) {
  const floorDocRef = doc(db, `hotels/${hotelId}/floors`, `level_${floorLevel}`);
  await setDoc(floorDocRef, {
    floorLevel: Number(floorLevel),
    imageUrl: dataUrl,
    uploadedAt: serverTimestamp(),
    label: `Floor ${floorLevel}`,
  }, { merge: true });

  console.log(`[FP-ADMIN] Floor plan saved to Firestore (base64)`);
  return { url: dataUrl };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COORDINATE MAPPING — Room placement on the image
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save a room coordinate (as percentage of image dimensions).
 * This allows the coordinates to scale with any display size.
 *
 * @param {string} hotelId
 * @param {number|string} floorLevel
 * @param {object} room — { id, name, type, xPercent, yPercent, widthPercent, heightPercent }
 */
export async function saveRoomCoordinate(hotelId, floorLevel, room) {
  const roomDocRef = doc(
    db,
    `hotels/${hotelId}/floors/level_${floorLevel}/rooms`,
    room.id
  );

  await setDoc(roomDocRef, {
    id: room.id,
    name: room.name || `Room ${room.id}`,
    type: room.type || 'room',
    xPercent: room.xPercent,     // 0.0 – 1.0, relative to image width
    yPercent: room.yPercent,     // 0.0 – 1.0, relative to image height
    widthPercent: room.widthPercent || 0.08,
    heightPercent: room.heightPercent || 0.12,
    capacity: room.capacity || 2,
    createdAt: serverTimestamp(),
  }, { merge: true });

  console.log(`[FP-ADMIN] Room ${room.name} saved at (${room.xPercent}, ${room.yPercent})`);
}

/**
 * Delete a room coordinate.
 */
export async function deleteRoomCoordinate(hotelId, floorLevel, roomId) {
  const roomDocRef = doc(
    db,
    `hotels/${hotelId}/floors/level_${floorLevel}/rooms`,
    roomId
  );
  await deleteDoc(roomDocRef);
  console.log(`[FP-ADMIN] Room ${roomId} deleted`);
}

/**
 * Get all room coordinates for a given floor.
 * @returns {Promise<Array<{id, name, type, xPercent, yPercent, widthPercent, heightPercent}>>}
 */
export async function getRoomCoordinates(hotelId, floorLevel) {
  const roomsCollRef = collection(
    db,
    `hotels/${hotelId}/floors/level_${floorLevel}/rooms`
  );
  const snap = await getDocs(roomsCollRef);
  const rooms = [];
  snap.forEach(d => rooms.push(d.data()));
  return rooms;
}

/**
 * Get the floor plan metadata (image URL, etc.) for a floor.
 */
export async function getFloorPlanMeta(hotelId, floorLevel) {
  const floorDocRef = doc(db, `hotels/${hotelId}/floors`, `level_${floorLevel}`);
  const snap = await getDoc(floorDocRef);
  if (snap.exists()) return snap.data();
  return null;
}

/**
 * Get all floors for a hotel.
 */
export async function getHotelFloors(hotelId) {
  const floorsCollRef = collection(db, `hotels/${hotelId}/floors`);
  const snap = await getDocs(floorsCollRef);
  const floors = [];
  snap.forEach(d => floors.push(d.data()));
  return floors.sort((a, b) => a.floorLevel - b.floorLevel);
}

/**
 * Update the floor label/name.
 */
export async function updateFloorLabel(hotelId, floorLevel, label) {
  const floorDocRef = doc(db, `hotels/${hotelId}/floors`, `level_${floorLevel}`);
  await updateDoc(floorDocRef, { label });
}

/**
 * Fetch full floor data (metadata + rooms) in one go for a specific floor.
 * @param {string} hotelId 
 * @param {number|string} floorLevel 
 * @returns {Promise<{meta: object, rooms: array}>}
 */
export async function getFullFloorData(hotelId, floorLevel) {
  const meta = await getFloorPlanMeta(hotelId, floorLevel);
  if (!meta) {
    return { meta: null, rooms: [] };
  }
  const rooms = await getRoomCoordinates(hotelId, floorLevel);
  return { meta, rooms };
}


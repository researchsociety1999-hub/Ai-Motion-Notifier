const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = 'ring-clips';
/** Signed URL TTL: 24 hours */
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

/**
 * Upload a buffer to Supabase Storage and return a signed URL
 * @param {Buffer} buffer - File content
 * @param {string} key - Storage path (e.g. clips/device123/1234567890.mp4)
 * @returns {string} Signed URL valid for SIGNED_URL_TTL_SECONDS
 */
async function uploadToSupabaseStorage(buffer, key) {
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  });

  if (uploadError) throw new Error(`Supabase upload failed: ${uploadError.message}`);

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);

  if (urlError) throw new Error(`Supabase signed URL failed: ${urlError.message}`);

  return data.signedUrl;
}

// Backward-compatible alias (deprecated)
const uploadToS3 = uploadToSupabaseStorage;

module.exports = { uploadToSupabaseStorage, uploadToS3 };

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = 'ring-clips';

/**
 * Upload a buffer to Supabase Storage and return a signed URL
 * @param {Buffer} buffer - File content
 * @param {string} key - Storage path (e.g. clips/device123/1234567890.mp4)
 * @param {number} [expiresIn=86400] - Signed URL TTL in seconds (default 24 hours)
 * @returns {string} Signed URL valid for 24 hours
 */
async function uploadToStorage(buffer, key, expiresIn = 86400) {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (uploadError) throw new Error(`Supabase storage upload failed: ${uploadError.message}`);

  // Generate a signed URL valid for 24 hours (86400 seconds)
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, expiresIn);

  if (urlError) throw new Error(`Supabase signed URL failed: ${urlError.message}`);

  return data.signedUrl;
}

module.exports = {
  uploadToStorage,
  uploadToS3: uploadToStorage,
};

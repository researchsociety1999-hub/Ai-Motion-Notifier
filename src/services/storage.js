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
 * @returns {string} Signed URL valid for 1 hour
 */
async function uploadToS3(buffer, key) {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (uploadError) throw new Error(`Supabase upload failed: ${uploadError.message}`);

  // Generate a signed URL valid for 1 hour (3600 seconds)
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, 3600);

  if (urlError) throw new Error(`Supabase signed URL failed: ${urlError.message}`);

  return data.signedUrl;
}

module.exports = { uploadToS3 };

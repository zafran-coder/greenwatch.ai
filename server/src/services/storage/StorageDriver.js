/**
 * StorageDriver base interface.
 */
export class StorageDriver {
  /**
   * Upload an image/file buffer to storage.
   * @param {Object} params
   * @param {string} params.path - Destination path (e.g. reports/r1/abc.webp)
   * @param {Buffer} params.buffer - File buffer
   * @param {string} [params.contentType='image/webp'] - MIME type
   * @returns {Promise<{ path: string, url: string }>}
   */
  async upload({ path, buffer, contentType = "image/webp" }) {
    throw new Error("StorageDriver.upload() not implemented");
  }

  /**
   * Delete one or more files from storage.
   * @param {string|string[]} paths - File path or array of paths
   * @returns {Promise<void>}
   */
  async delete(paths) {
    throw new Error("StorageDriver.delete() not implemented");
  }

  /**
   * Get public or accessible URL for a given path.
   * @param {string} path - Storage path
   * @returns {Promise<string>|string}
   */
  async getUrl(path) {
    throw new Error("StorageDriver.getUrl() not implemented");
  }

  /**
   * Get short-lived signed URL for a given path.
   * @param {string} path - Storage path
   * @param {number} [expiresIn=3600] - Expiration in seconds
   * @returns {Promise<string>}
   */
  async getSignedUrl(path, expiresIn = 3600) {
    throw new Error("StorageDriver.getSignedUrl() not implemented");
  }

  /**
   * Retrieve file bytes as a Buffer.
   * @param {string} path - Storage path
   * @returns {Promise<Buffer>}
   */
  async getBuffer(path) {
    throw new Error("StorageDriver.getBuffer() not implemented");
  }

  /**
   * Check if a file exists in storage.
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async exists(path) {
    throw new Error("StorageDriver.exists() not implemented");
  }
}

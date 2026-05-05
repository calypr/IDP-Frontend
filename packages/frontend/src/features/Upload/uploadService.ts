export const uploadFileWithProgress = (
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    request.onerror = () => {
      reject(new Error('Upload failed'));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size, file.size);
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${request.status}`));
    };

    request.send(file);
  });

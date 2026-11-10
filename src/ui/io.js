/**
 * The one place the app hands a file to the browser. Tests replace `io.download` with a recorder.
 * Nothing is sent anywhere: the file is made in the page and saved by the browser.
 */
export const io = {
  download(content, fileName, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

const writeQR = paulmillrQr.encode.default;
const { frontalCamera, QRCanvas, frameLoop, getSize } = paulmillrQr.dom;

let IS_STARTED_VIDEO = false;

const pad = (n, z = 2) => ('' + n).padStart(z, '0');

const time = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(
    d.getMilliseconds(),
    3
  )}`;
};

const log = (...txt) => {
  const el = document.querySelector('#log');
  el.innerHTML = `${time()} ${txt.join(' ').replace('\n', '<br>')}<hr>` + el.innerHTML;
};

const error = (...txt) => log('[<span class="qr-error">ERROR</span>]', ...txt);
const ok = (...txt) => log('[<span class="qr-ok">OK</span>]', ...txt);

function fpsCounter(elm, frameCount) {
  const values = [];
  let prevTs;
  let cnt = 0;
  return frameLoop((ts) => {
    if (prevTs === undefined) prevTs = ts;
    else {
      const elapsed = ts - prevTs;
      prevTs = ts;
      values.push(elapsed);
      if (values.length > frameCount) values.shift();
      const avgFrameTime = values.reduce((a, b) => a + b, 0) / values.length;
      const fps = 1000 / avgFrameTime;
      // 10 is pretty random, just to make counter readable
      if (cnt++ % 10 === 0) elm.innerText = `${fps.toFixed(2)} FPS`;
    }
  });
}

function main() {
  ok('Started');
  fpsCounter(document.querySelector('#fps-counter'), 60); // last 60 frames FPS
  // Error handlers
  window.onerror = (message) => error('Onerror:', message);
  window.addEventListener('unhandledrejection', (event) => error('Promise:', event.reason));
  // Decode (camera)
  // DOM elements
  // const controls = document.querySelector('#controls');
  const camSelContainer = document.querySelector('.camera-start-container');
  const player = document.querySelector('video');
  const overlay = document.querySelector('#overlay');
  const resultTxt = document.querySelector('#resultTxt');
  const resultTxtLabel = document.querySelector('#resultTxtLabel');
  const resultQr = document.querySelector('#resultQr');
  const bitmapCanvas = document.querySelector('#bitmap');
  const imgEncodeQr = document.querySelector('#encResultQr');
  const inputEncode = document.querySelector('#input-encode');
  const resultsContainer = document.querySelector('#results-container');
  let canvasQr;
  // Checkboxes
  const isDrawQr = document.querySelector('#isDrawQr');
  const isDrawBitmap = document.querySelector('#isDrawBitmap');
  const isCropToSquare = document.querySelector('#isCropToSquare');
  const isLogDecoded = document.querySelector('#isLogDecoded');
  const isFullVideo = document.querySelector('#isFullVideo');
  // Main canvas setup
  const setup = () => {
    if (canvasQr) canvasQr.clear();
    canvasQr = new QRCanvas(
      {
        overlay,
        bitmap: isDrawBitmap.checked ? bitmapCanvas : undefined,
        resultQR: isDrawQr.checked ? resultQr : undefined,
      },
      { cropToSquare: isCropToSquare.checked }
    );
  };
  setup();
  for (const c of [isDrawQr, isDrawBitmap, isCropToSquare]) c.addEventListener('change', setup);

  const addCameraSelect = (devices) => {
    const select = document.createElement('select');
    select.id = 'camera-select';
    select.onchange = () => {
      const deviceId = select.value;
      if (camera) camera.setDevice(deviceId);
    };
    for (const { deviceId, label } of devices) {
      const option = document.createElement('option');
      option.value = deviceId;
      option.text = label;
      select.appendChild(option);
    }
    camSelContainer.appendChild(select);
  };

  let camera;
  let cancelMainLoop;
  const mainLoop = () =>
    frameLoop((ts) => {
      const res = camera.readFrame(canvasQr, isFullVideo.checked);
      if (res !== undefined) {
        resultTxt.innerText = res;
        resultTxtLabel.style.display = 'inline';
        if (isLogDecoded.checked) ok('Decoded', `"${res}"`, `${performance.now() - ts} ms`);
      }
    });

  document.querySelector('video').addEventListener('play', () => {
    // We won't have correct size until video starts playing
    const { height, width } = getSize(player);
    ok(
      `Got video feed: element=${width}x${height}, video=${player.videoWidth}x${player.videoHeight}`
    );
    if (cancelMainLoop) cancelMainLoop(); // stop
    cancelMainLoop = mainLoop();
  });
  document.querySelector('#startBtn').addEventListener('click', async (e) => {
    // NOTE: there is race-condition which with await frontalCamera & stop.
    // But not sure it is possible to trigger
    const btn = e.target;
    if (!IS_STARTED_VIDEO) {
      try {
        player.style.display = 'block';
        btn.innerText = 'Stop';
        IS_STARTED_VIDEO = true;
        camera = await frontalCamera(player);
        addCameraSelect(await camera.listDevices());
      } catch (e) {
        error('Media loop', e);
      }
    } else {
      if (camera) camera.stop();
      if (cancelMainLoop) cancelMainLoop();
      if (canvasQr) canvasQr.clear();
      btn.innerText = 'Start video capturing';
      document.querySelector('#camera-select').remove();
      const { height, width } = getSize(player);
      resultsContainer.style.height = `${height}px`;
      resultsContainer.style.width = `${width}px`;
      IS_STARTED_VIDEO = false;
    }
  });
  // Decode image
  async function imageFromUrl(url) {
    const image = new Image();
    return new Promise((resolve) => {
      image.src = url;
      image.addEventListener('load', () => resolve(image));
    });
  }
  async function readFileInput(element) {
    return new Promise((resolve, reject) => {
      const file = FileReader && element.files && element.files[0];
      if (!file) return reject();
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        let res = reader.result;
        if (!res) return reject(new Error('No file'));
        resolve(URL.createObjectURL(new Blob([new Uint8Array(res)])));
      });
      reader.addEventListener('error', reject);
      reader.readAsArrayBuffer(file);
    });
  }
  const qrImageFile = document.querySelector('#qr-decode-image');
  const qrImageResult = document.querySelector('#qr-decode-image-result');
  const qrImageClear = document.querySelector('#qr-decode-image-clear');
  const qrImageDebug = document.querySelector('#qr-decode-debug');
  function appendWithLabel(labelText, element) {
    const label = document.createElement('p');
    label.textContent = labelText;
    qrImageResult.appendChild(label);
    if (element) {
      element.style = '';
      qrImageResult.appendChild(element);
    }
  }
  const clearQrImageResult = () => qrImageResult.replaceChildren();
  qrImageClear.addEventListener('click', () => clearQrImageResult());
  qrImageFile.addEventListener('change', async (ev) => {
    clearQrImageResult();
    const data = await readFileInput(ev.target);
    const img = await imageFromUrl(data);
    const overlayCanvas = document.createElement('canvas');
    const bitmapCanvas = document.createElement('canvas');
    const resultCanvas = document.createElement('canvas');
    const qr = new QRCanvas(
      {
        overlay: overlayCanvas,
        bitmap: bitmapCanvas,
        resultQR: resultCanvas,
      },
      { cropToSquare: isCropToSquare.checked }
    );
    const decoded = qr.drawImage(img, img.height, img.width);
    if (qrImageDebug.checked) {
      appendWithLabel('Overlay', overlayCanvas);
      appendWithLabel('Bitmap', bitmapCanvas);
      appendWithLabel('Result QR', resultCanvas);
    }
    if (decoded !== undefined) {
      appendWithLabel('Decoded');
      appendWithLabel(decoded);
    } else appendWithLabel('QR not found!');
  });

  // Encoding
  const qrGifDataUrl = (text) => {
    const gifBytes = writeQR(text, 'gif', {
      scale: 7,
    });
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    return URL.createObjectURL(blob);
  };
  inputEncode.addEventListener('input', (e) => {
    const text = e.target.value;
    imgEncodeQr.src = qrGifDataUrl(text);
  });

  imgEncodeQr.src = qrGifDataUrl(inputEncode.value);
}

window.addEventListener('load', main);

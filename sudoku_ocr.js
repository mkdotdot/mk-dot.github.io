// sudoku_ocr.js

(function () {
	function loadScriptWithFallback(urls, state = null, label = 'script') {
		if (!Array.isArray(urls) || urls.length === 0) return;
		let index = 0;

		const tryNext = () => {
			if (index >= urls.length) {
				if (state) state.exhausted = true;
				return;
			}

			const url = urls[index];
			if (state) {
				state.attempts.push(url);
				state.lastTriedUrl = url;
			}

			const script = document.createElement('script');
			script.src = url;
			script.async = true;
			script.onload = () => {
				if (state) {
					state.loaded = true;
					state.loadedUrl = url;
				}
				console.log(`[${label}] loaded: ${url}`);
			};
			script.onerror = () => {
				if (state) {
					state.loaded = false;
					state.lastError = `${label} load failed: ${url}`;
				}
				console.warn(`[${label}] load failed: ${url}`);
				index += 1;
				tryNext();
			};
			document.head.appendChild(script);
		};

		tryNext();
	}

	const openCvLoadState = {
		loaded: false,
		loadedUrl: '',
		lastTriedUrl: '',
		lastError: '',
		attempts: [],
		exhausted: false
	};

	let tesseractWorkerPromise = null;

	const tesseractScript = document.createElement('script');
	tesseractScript.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/tesseract.min.js';
	document.head.appendChild(tesseractScript);

	loadScriptWithFallback([
		'./opencv.js',
		'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0/dist/opencv.js',
		'https://unpkg.com/@techstark/opencv-js@4.10.0/dist/opencv.js'
	], openCvLoadState, 'OpenCV');

	function normalizeOcrText(text) {
		return text.replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 65248));
	}

	function resolveOcrOptions(preset, image) {
		const base = {
			minDensity: 0.01,
			maxDensity: 0.65,
			minAcceptedConfidence: 30,
			earlyAcceptConfidence: 85,
			resizePx: 72,
			useSecondCandidate: true,
			useDenoiseCandidate: false,
			innerMarginRate: 0.18,
			blurKernelSize: 5,
			thresholdBlockSize: 11,
			thresholdC: 2,
			warpedMedianBlurKsize: 0,
			morphOpenIterations: 0,
			morphCloseIterations: 0,
			resolvedPreset: preset
		};

		if (preset === 'smartphone') {
			return {
				...base,
				minDensity: 0.006,
				maxDensity: 0.96,
				minAcceptedConfidence: 16,
				earlyAcceptConfidence: 80,
				resizePx: 88,
				innerMarginRate: 0.2,
				blurKernelSize: 5,
				thresholdBlockSize: 11,
				thresholdC: 2,
				warpedMedianBlurKsize: 0,
				morphOpenIterations: 0,
				morphCloseIterations: 0,
				useSecondCandidate: true,
				useDenoiseCandidate: true
			};
		}

		if (preset === 'screenshot') {
			return {
				...base,
				minDensity: 0.015,
				maxDensity: 0.5,
				minAcceptedConfidence: 40,
				earlyAcceptConfidence: 90,
				resizePx: 64,
				innerMarginRate: 0.2,
				blurKernelSize: 3,
				thresholdBlockSize: 11,
				thresholdC: 2,
				warpedMedianBlurKsize: 0,
				morphOpenIterations: 0,
				morphCloseIterations: 0,
				useSecondCandidate: false
			};
		}

		const width = image?.naturalWidth || image?.width || 0;
		const height = image?.naturalHeight || image?.height || 0;
		const pixelCount = width * height;
		if (pixelCount > 1600000) {
			return {
				...base,
				resolvedPreset: 'smartphone',
				minDensity: 0.006,
				maxDensity: 0.96,
				minAcceptedConfidence: 16,
				earlyAcceptConfidence: 80,
				resizePx: 88,
				innerMarginRate: 0.2,
				blurKernelSize: 5,
				thresholdBlockSize: 11,
				thresholdC: 2,
				warpedMedianBlurKsize: 0,
				morphOpenIterations: 0,
				morphCloseIterations: 0,
				useSecondCandidate: true,
				useDenoiseCandidate: true
			};
		}

		return {
			...base,
			resolvedPreset: 'screenshot',
			minDensity: 0.015,
			maxDensity: 0.5,
			minAcceptedConfidence: 40,
			earlyAcceptConfidence: 90,
			resizePx: 64,
			innerMarginRate: 0.2,
			blurKernelSize: 3,
			thresholdBlockSize: 11,
			thresholdC: 2,
			warpedMedianBlurKsize: 0,
			morphOpenIterations: 0,
			morphCloseIterations: 0,
			useSecondCandidate: false,
			useDenoiseCandidate: false
		};
	}

	function waitForTesseract(timeoutMs = 20000) {
		return new Promise((resolve, reject) => {
			if (window.Tesseract) {
				resolve();
				return;
			}
			const start = Date.now();
			const timer = setInterval(() => {
				if (window.Tesseract) {
					clearInterval(timer);
					resolve();
					return;
				}
				if (Date.now() - start > timeoutMs) {
					clearInterval(timer);
					reject(new Error('tesseract-timeout'));
				}
			}, 100);
		});
	}

	function waitForOpenCv(timeoutMs = 20000) {
		return new Promise((resolve, reject) => {
			if (window.cv && window.cv.Mat) {
				resolve();
				return;
			}
			const start = Date.now();
			const timer = setInterval(() => {
				if (window.cv && window.cv.Mat) {
					clearInterval(timer);
					resolve();
					return;
				}
				if (Date.now() - start > timeoutMs) {
					clearInterval(timer);
					const tried = openCvLoadState.attempts.length ? openCvLoadState.attempts.join(' | ') : 'none';
					const detail = `loaded=${openCvLoadState.loaded}, lastTried=${openCvLoadState.lastTriedUrl || 'none'}, exhausted=${openCvLoadState.exhausted}, tried=${tried}`;
					reject(new Error(`opencv-timeout: ${detail}`));
				}
			}, 100);
		});
	}

	function loadImageElement(dataUrl) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error('image-load-failed'));
			image.src = dataUrl;
		});
	}

	function orderPoints(points) {
		const sums = points.map(p => p.x + p.y);
		const diffs = points.map(p => p.y - p.x);

		const tl = points[sums.indexOf(Math.min(...sums))];
		const br = points[sums.indexOf(Math.max(...sums))];
		const tr = points[diffs.indexOf(Math.min(...diffs))];
		const bl = points[diffs.indexOf(Math.max(...diffs))];

		return [tl, tr, br, bl];
	}

	function findBoardCorners(binaryMat) {
		const contours = new cv.MatVector();
		const hierarchy = new cv.Mat();
		cv.findContours(binaryMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

		let bestCorners = null;
		let maxArea = 0;

		for (let i = 0; i < contours.size(); i++) {
			const contour = contours.get(i);
			const area = cv.contourArea(contour);
			if (area < 1000) {
				contour.delete();
				continue;
			}

			const peri = cv.arcLength(contour, true);
			const approx = new cv.Mat();
			cv.approxPolyDP(contour, approx, 0.02 * peri, true);

			if (approx.rows === 4 && area > maxArea) {
				const pts = [];
				for (let j = 0; j < 4; j++) {
					const x = approx.intPtr(j, 0)[0];
					const y = approx.intPtr(j, 0)[1];
					pts.push({ x, y });
				}
				bestCorners = orderPoints(pts);
				maxArea = area;
			}

			approx.delete();
			contour.delete();
		}

		contours.delete();
		hierarchy.delete();

		if (bestCorners) return bestCorners;

		return [
			{ x: 0, y: 0 },
			{ x: binaryMat.cols - 1, y: 0 },
			{ x: binaryMat.cols - 1, y: binaryMat.rows - 1 },
			{ x: 0, y: binaryMat.rows - 1 }
		];
	}

	function matToDataUrl(mat) {
		const canvas = document.createElement('canvas');
		canvas.width = mat.cols;
		canvas.height = mat.rows;
		cv.imshow(canvas, mat);
		return canvas.toDataURL('image/png');
	}

	async function getTesseractWorker() {
		if (!tesseractWorkerPromise) {
			tesseractWorkerPromise = (async () => {
				const worker = await window.Tesseract.createWorker();
				await worker.loadLanguage('eng');
				await worker.initialize('eng');
				await worker.setParameters({
					tessedit_char_whitelist: '123456789',
					tessedit_pageseg_mode: '10'
				});
				return worker;
			})();
		}
		return tesseractWorkerPromise;
	}

	async function recognizeSingleDigit(worker, dataUrl) {
		const result = await worker.recognize(dataUrl);
		const text = normalizeOcrText(result.data.text || '');
		const digit = text.replace(/[^1-9]/g, '').charAt(0);
		const confidence = Number.isFinite(result?.data?.confidence) ? Number(result.data.confidence) : 0;
		return { digit: digit || '', confidence };
	}

	async function recognizeSingleDigitFromCandidates(worker, candidateDataUrls, earlyAcceptConfidence) {
		let best = { digit: '', confidence: 0 };
		for (const dataUrl of candidateDataUrls) {
			const current = await recognizeSingleDigit(worker, dataUrl);
			if (current.digit && current.confidence >= best.confidence) {
				best = current;
			}
			if (best.digit && best.confidence >= earlyAcceptConfidence) {
				break;
			}
		}
		return best;
	}

	function extractWarpedBoardBinary(image, onProgress = () => {}, onDebugBinary = null, ocrOptions = null) {
		const options = ocrOptions || {};
		const toOdd = (value, fallback) => {
			const raw = Number(value);
			if (!Number.isFinite(raw) || raw < 3) return fallback;
			const n = Math.floor(raw);
			return n % 2 === 1 ? n : n + 1;
		};
		const blurKernelSize = toOdd(options.blurKernelSize, 5);
		const thresholdBlockSize = toOdd(options.thresholdBlockSize, 11);
		const thresholdC = Number.isFinite(Number(options.thresholdC)) ? Number(options.thresholdC) : 2;
		const warpedMedianBlurKsize = toOdd(options.warpedMedianBlurKsize, 3);
		const morphOpenIterations = Math.max(0, Number(options.morphOpenIterations || 0));
		const morphCloseIterations = Math.max(0, Number(options.morphCloseIterations || 0));

		onProgress('前処理: 画像をキャンバスへ読み込み中...');
		const srcCanvas = document.createElement('canvas');
		srcCanvas.width = image.naturalWidth || image.width;
		srcCanvas.height = image.naturalHeight || image.height;
		const ctx = srcCanvas.getContext('2d');
		ctx.drawImage(image, 0, 0);

		const src = cv.imread(srcCanvas);
		const gray = new cv.Mat();
		const blurred = new cv.Mat();
		const binary = new cv.Mat();

		onProgress('前処理: グレースケール変換中...');
		cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
		onProgress('前処理: ノイズ除去中...');
		cv.GaussianBlur(gray, blurred, new cv.Size(blurKernelSize, blurKernelSize), 0);
		onProgress('前処理: 2値化中...');
		cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, thresholdBlockSize, thresholdC);

		onProgress('盤面検出: 外枠を探索中...');
		const corners = findBoardCorners(binary);
		const [tl, tr, br, bl] = corners;
		const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
		const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
		const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
		const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
		const side = Math.max(360, Math.floor(Math.max(widthTop, widthBottom, heightLeft, heightRight)));

		const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
		const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, side - 1, 0, side - 1, side - 1, 0, side - 1]);
		const transform = cv.getPerspectiveTransform(srcTri, dstTri);

		onProgress('盤面補正: 透視変換中...');
		const warped = new cv.Mat();
		cv.warpPerspective(gray, warped, transform, new cv.Size(side, side));
		const warpedForThreshold = new cv.Mat();
		if (warpedMedianBlurKsize >= 3) {
			cv.medianBlur(warped, warpedForThreshold, warpedMedianBlurKsize);
		} else {
			warped.copyTo(warpedForThreshold);
		}

		onProgress('盤面補正: 補正後画像を2値化中...');
		const warpedBinary = new cv.Mat();
		cv.adaptiveThreshold(warpedForThreshold, warpedBinary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, thresholdBlockSize, thresholdC);
		if (morphOpenIterations > 0 || morphCloseIterations > 0) {
			const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
			for (let i = 0; i < morphOpenIterations; i++) {
				cv.morphologyEx(warpedBinary, warpedBinary, cv.MORPH_OPEN, kernel);
			}
			for (let i = 0; i < morphCloseIterations; i++) {
				cv.morphologyEx(warpedBinary, warpedBinary, cv.MORPH_CLOSE, kernel);
			}
			kernel.delete();
		}

		if (typeof onDebugBinary === 'function') {
			onDebugBinary(matToDataUrl(warpedBinary));
		}

		src.delete();
		gray.delete();
		blurred.delete();
		binary.delete();
		srcTri.delete();
		dstTri.delete();
		transform.delete();
		warped.delete();
		warpedForThreshold.delete();

		return { warpedBinary, side };
	}

	async function run(dataUrl, options = {}) {
		const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
		const onDebugBinary = typeof options.onDebugBinary === 'function' ? options.onDebugBinary : null;
		const preset = options.preset || 'auto';

		onProgress('OCR準備: OpenCVの読み込み待ち...');
		await waitForOpenCv();
		onProgress('OCR準備: Tesseractの読み込み待ち...');
		await waitForTesseract();
		onProgress('OCR準備: Tesseractワーカー準備中...');
		const worker = await getTesseractWorker();

		onProgress('画像読み込み中...');
		const image = await loadImageElement(dataUrl);
		const ocrOptions = resolveOcrOptions(preset, image);
		onProgress(`OCRモード: ${ocrOptions.resolvedPreset}`);
		const { warpedBinary, side } = extractWarpedBoardBinary(image, onProgress, onDebugBinary, ocrOptions);
		const cellSize = Math.floor(side / 9);
		const digits = Array(81).fill('');

		onProgress('セル解析開始: 0/81');
		let processed = 0;
		for (let row = 0; row < 9; row++) {
			for (let col = 0; col < 9; col++) {
				const x = col * cellSize;
				const y = row * cellSize;
				const w = col === 8 ? side - x : cellSize;
				const h = row === 8 ? side - y : cellSize;

				const cellRect = new cv.Rect(x, y, w, h);
				const cellMat = warpedBinary.roi(cellRect);

				const marginX = Math.floor(w * ocrOptions.innerMarginRate);
				const marginY = Math.floor(h * ocrOptions.innerMarginRate);
				const innerRect = new cv.Rect(marginX, marginY, Math.max(1, w - marginX * 2), Math.max(1, h - marginY * 2));
				const innerMat = cellMat.roi(innerRect);

				const nonZero = cv.countNonZero(innerMat);
				const area = innerRect.width * innerRect.height;
				const density = area > 0 ? nonZero / area : 0;

				if (density > ocrOptions.minDensity && density < ocrOptions.maxDensity) {
					const enlarged = new cv.Mat();
					cv.resize(innerMat, enlarged, new cv.Size(ocrOptions.resizePx, ocrOptions.resizePx), 0, 0, cv.INTER_LINEAR);

					const invertedA = new cv.Mat();
					cv.bitwise_not(enlarged, invertedA);

					const thresholded = new cv.Mat();
					cv.threshold(enlarged, thresholded, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
					const invertedB = new cv.Mat();
					cv.bitwise_not(thresholded, invertedB);

					const candidateDataUrls = [matToDataUrl(invertedA)];
					if (ocrOptions.useSecondCandidate) {
						candidateDataUrls.push(matToDataUrl(invertedB));
					}
					if (ocrOptions.useDenoiseCandidate) {
						const denoised = new cv.Mat();
						cv.medianBlur(enlarged, denoised, 3);
						const denoiseThreshold = new cv.Mat();
						cv.threshold(denoised, denoiseThreshold, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
						const invertedC = new cv.Mat();
						cv.bitwise_not(denoiseThreshold, invertedC);
						candidateDataUrls.push(matToDataUrl(invertedC));
						denoised.delete();
						denoiseThreshold.delete();
						invertedC.delete();
					}

					const idx = row * 9 + col;
					onProgress(`セルOCR中: ${idx + 1}/81`);
					const best = await recognizeSingleDigitFromCandidates(worker, candidateDataUrls, ocrOptions.earlyAcceptConfidence);
					if (best.digit && best.confidence >= ocrOptions.minAcceptedConfidence) {
						digits[idx] = best.digit;
					}

					enlarged.delete();
					invertedA.delete();
					thresholded.delete();
					invertedB.delete();
				}

				innerMat.delete();
				cellMat.delete();

				processed += 1;
				if (processed % 9 === 0 || processed === 81) {
					onProgress(`セル解析中: ${processed}/81`);
				}
			}
		}

		onProgress('OCR後処理中...');
		warpedBinary.delete();
		return digits;
	}

	window.SudokuOCR = {
		run
	};
})();

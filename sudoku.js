// sudoku.js

document.addEventListener('DOMContentLoaded', () => {
	// 主要DOM参照
	const board = document.querySelector('.sudoku-board');
	const cells = Array.from(document.querySelectorAll('.sudoku-board .cell'));
	const msg = document.querySelector('.message');
	const numberButtons = Array.from(document.querySelectorAll('.number-btn'));

	const pencilModeBtn = document.getElementById('pencilModeBtn');
	const autoInputBtn = document.getElementById('autoInputBtn');
	const fixedModeLabel = document.getElementById('fixedModeLabel');
	const fixedModeCheckbox = document.getElementById('fixedModeCheckbox');
	const newGameBtn = document.getElementById('newGameBtn');
	const resetBoardBtn = document.getElementById('resetBoardBtn');
	const startGameBtn = document.getElementById('startGameBtn');
	const ocrBtn = document.getElementById('ocrBtn');
	const undoBtn = document.getElementById('undoBtn');
	const redoBtn = document.getElementById('redoBtn');
	const saveProgressBtn = document.getElementById('saveProgressBtn');
	const loadProgressBtn = document.getElementById('loadProgressBtn');
	const saveInitialBtn = document.getElementById('saveInitialBtn');
	const loadInitialBtn = document.getElementById('loadInitialBtn');
	const ocrPresetSelect = document.getElementById('ocrPresetSelect');

	// 画面状態（選択セル、各モード、履歴）
	let selectedCell = null;
	let selectedNumber = null;
	let pencilMode = false;
	let autoInputMode = false;
	let fixedMode = false;
	let isSetupMode = true;
	let history = [];
	let historyIndex = -1;
	const ocrDebugImages = [
		{ key: 'original', title: '選択画像', dataUrl: '' },
		{ key: 'binary', title: '2値化画像（盤面補正後）', dataUrl: '' }
	];
	let ocrDebugIndex = 0;

	// 現在ラジオで選択中の色名（color1〜3）を取得
	function getSelectedColorName() {
		const checked = document.querySelector('input[name="numColor"]:checked');
		return checked ? checked.value : 'color1';
	}

	// セルの色クラス（num-color1〜3）を付け替える
	function setCellColorClass(cell, colorName) {
		cell.classList.remove('num-color1', 'num-color2', 'num-color3');
		cell.classList.add(`num-${colorName}`);
	}

	// メモ数字(span)の色クラス（memo-color1〜3）を付け替える
	function setMemoSpanColorClass(span, colorName) {
		span.classList.remove('memo-color1', 'memo-color2', 'memo-color3');
		span.classList.add(`memo-${colorName}`);
	}

	// セルに設定されている色クラス（num-color1〜3）を取得
	function getCellColorClass(cell) {
		if (cell.classList.contains('num-color2')) return 'num-color2';
		if (cell.classList.contains('num-color3')) return 'num-color3';
		return 'num-color1';
	}

	// メモ数字(span)の色クラス（memo-color1〜3）を取得
	function getMemoSpanColorClass(span) {
		if (!span || !span.textContent) return 'memo-color1';
		if (span.classList.contains('memo-color2')) return 'memo-color2';
		if (span.classList.contains('memo-color3')) return 'memo-color3';
		return 'memo-color1';
	}

	// セルの一次元インデックス（0〜80）を返す
	function getCellIndex(cell) {
		return cells.indexOf(cell);
	}

	// セル内のメモDOMを取得（なければnull）
	function getMemoDiv(cell) {
		return cell.querySelector('.memo');
	}

	// セルが「確定数字」を持つ場合のみ 1〜9 を返す（メモのみセルは空文字）
	function getCellNumber(cell) {
		if (getMemoDiv(cell)) return '';
		const value = (cell.textContent || '').trim();
		return /^[1-9]$/.test(value) ? value : '';
	}

	// 3x3配置のメモ領域を新規作成
	function createMemoDiv() {
		const memo = document.createElement('div');
		memo.className = 'memo';
		for (let i = 1; i <= 9; i++) {
			const span = document.createElement('span');
			span.textContent = '';
			memo.appendChild(span);
		}
		return memo;
	}

	// メモが全消去されたらメモDOM自体を削除
	function clearMemoIfEmpty(cell) {
		const memo = getMemoDiv(cell);
		if (!memo) return;
		const hasAny = Array.from(memo.children).some(span => span.textContent);
		if (!hasAny) memo.remove();
	}

	// セル内容をクリア（必要に応じてfixedは維持）
	function clearCell(cell, keepFixed = false) {
		cell.textContent = '';
		cell.classList.remove('input');
		cell.classList.remove('num-color1', 'num-color2', 'num-color3');
		if (!keepFixed) {
			cell.classList.remove('fixed');
		}
		const memo = getMemoDiv(cell);
		if (memo) memo.remove();
	}

	// セル選択と行/列ハイライトを更新
	function selectCell(cell) {
		cells.forEach(c => c.classList.remove('selected'));
		cell.classList.add('selected');
		selectedCell = cell;
		
		// 自動入力OFFの場合のみ、セルの確定数字で数字ボタンを強調
		// 自動入力ONの場合は、数字ボタンの選択状態を変えずに、選択中の数字で強調を更新
		if (!autoInputMode) {
			const cellNum = getCellNumber(cell);
			setNumberButtonSelection(cellNum);
		}
		
		highlightRowCol(cell);
	}

	// 選択セルの行・列をハイライト
	function highlightRowCol(cell) {
		const idx = getCellIndex(cell);
		const row = Math.floor(idx / 9);
		const col = idx % 9;
		
		// 自動入力ONの時は selectedNumber を使用、OFFの時はセルの確定数字を使用
		let selectedValue = '';
		if (autoInputMode && selectedNumber) {
			selectedValue = selectedNumber;
		} else {
			const selectedMemo = getMemoDiv(cell);
			selectedValue = !selectedMemo ? getCellNumber(cell) : '';
		}
		
		cells.forEach((c, i) => {
			c.classList.remove('highlight-row-col');
			c.classList.remove('same-number');
			const memo = getMemoDiv(c);
			if (memo) {
				Array.from(memo.children).forEach(span => span.classList.remove('same-number'));
			}
			// 行・列は常に強調
			if (Math.floor(i / 9) === row || i % 9 === col) {
				c.classList.add('highlight-row-col');
			}
			// 同じ数字を強調（選択中のセルも含める）
			if (selectedValue) {
				if (!memo && getCellNumber(c) === selectedValue) {
					c.classList.add('same-number');
				}
				if (memo) {
					const span = memo.children[Number(selectedValue) - 1];
					if (span && span.textContent === selectedValue) {
						span.classList.add('same-number');
					}
				}
			}
		});
	}

	// 確定数字入力時、同じ行・列・3x3ブロック内の同数字メモを消す
	function clearPeerMemosByNumber(sourceCell, num) {
		const srcIdx = getCellIndex(sourceCell);
		const srcRow = Math.floor(srcIdx / 9);
		const srcCol = srcIdx % 9;
		const srcBlockRow = Math.floor(srcRow / 3) * 3;
		const srcBlockCol = Math.floor(srcCol / 3) * 3;

		cells.forEach((cell, idx) => {
			if (idx === srcIdx) return;
			const row = Math.floor(idx / 9);
			const col = idx % 9;
			const inSameRow = row === srcRow;
			const inSameCol = col === srcCol;
			const inSameBlock = row >= srcBlockRow && row < srcBlockRow + 3 && col >= srcBlockCol && col < srcBlockCol + 3;
			if (!inSameRow && !inSameCol && !inSameBlock) return;

			const memo = getMemoDiv(cell);
			if (!memo) return;
			const span = memo.children[Number(num) - 1];
			if (!span || span.textContent !== num) return;

			span.textContent = '';
			span.classList.remove('memo-color1', 'memo-color2', 'memo-color3', 'same-number');
			clearMemoIfEmpty(cell);
		});
	}

	// 選択中の数字ボタン見た目を更新
	function setNumberButtonSelection(num) {
		numberButtons.forEach(btn => {
			btn.classList.toggle('selected', btn.textContent === num);
		});
	}

	// 仮置き数字をトグル入力（同じ数字でON/OFF）
	function toggleMemo(cell, num) {
		let memo = getMemoDiv(cell);
		if (!memo) {
			memo = createMemoDiv();
			cell.appendChild(memo);
		}
		const index = Number(num) - 1;
		const span = memo.children[index];
		if (span.textContent) {
			span.textContent = '';
			span.classList.remove('memo-color1', 'memo-color2', 'memo-color3');
		} else {
			span.textContent = num;
			setMemoSpanColorClass(span, getSelectedColorName());
		}
		clearMemoIfEmpty(cell);
	}

	// セルへ数字を入力する中核関数（通常入力/仮置き/固定入力を統合）
	function putNumber(cell, num) {
		if (cell.classList.contains('fixed') && !fixedMode) return false;

		// 仮置きモード: 通常数字がある場合は固定でない限り消してからメモ化
		if (pencilMode) {
			const hasMemo = !!getMemoDiv(cell);
			if (!hasMemo && getCellNumber(cell)) {
				if (cell.classList.contains('fixed')) return false;
				cell.textContent = '';
				cell.classList.remove('input');
			}
			toggleMemo(cell, num);
			return true;
		}

		// 同じ数字を再入力した場合は消去
		const current = getCellNumber(cell);
		if (current === num) {
			clearCell(cell, cell.classList.contains('fixed') && fixedMode);
			validateBoard();
			return true;
		}

		// 通常入力: 数字を書き込み、メモは消去
		cell.textContent = num;
		const memo = getMemoDiv(cell);
		if (memo) memo.remove();

		// 固定入力中ならfixed、ゲーム中ならinputとして表示区別
		if (fixedMode) {
			cell.classList.add('fixed');
			cell.classList.remove('input');
			cell.classList.remove('num-color1', 'num-color2', 'num-color3');
		} else {
			cell.classList.remove('fixed');
			cell.classList.add('input');
			setCellColorClass(cell, getSelectedColorName());
		}

		clearPeerMemosByNumber(cell, num);

		validateBoard();
		return true;
	}

	// 現在の盤面をシリアライズ可能な状態へ変換
	function getBoardState() {
		return cells.map(cell => {
			const memo = getMemoDiv(cell);
			return {
				text: getCellNumber(cell),
				fixed: cell.classList.contains('fixed'),
				cellColor: getCellColorClass(cell),
				memo: memo ? Array.from(memo.children).map(span => span.textContent || '') : null,
				memoColors: memo ? Array.from(memo.children).map(span => getMemoSpanColorClass(span)) : null
			};
		});
	}

	// 保存データや履歴から盤面状態を復元
	function applyBoardState(state) {
		if (!Array.isArray(state) || state.length !== 81) return;
		cells.forEach((cell, i) => {
			clearCell(cell);
			cell.textContent = state[i].text || '';
			cell.classList.toggle('fixed', !!state[i].fixed);
			cell.classList.toggle('input', !!state[i].text && !state[i].fixed);
			if (state[i].text && !state[i].fixed) {
				cell.classList.remove('num-color1', 'num-color2', 'num-color3');
				cell.classList.add(state[i].cellColor || 'num-color1');
			} else {
				cell.classList.remove('num-color1', 'num-color2', 'num-color3');
			}
			if (state[i].memo && state[i].memo.some(v => v)) {
				const memo = createMemoDiv();
				for (let j = 0; j < 9; j++) {
					const span = memo.children[j];
					const value = state[i].memo[j] || '';
					span.textContent = value;
					if (value) {
						const colorClass = state[i].memoColors?.[j] || state[i].memoColor || 'memo-color1';
						span.classList.remove('memo-color1', 'memo-color2', 'memo-color3');
						span.classList.add(colorClass);
					}
				}
				cell.appendChild(memo);
			}
		});
		validateBoard();
	}

	// 履歴スタックに現在状態を積む（同一状態は重複保存しない）
	function saveHistory() {
		const state = getBoardState();
		const serialized = JSON.stringify(state);
		const prev = history[historyIndex] ? JSON.stringify(history[historyIndex]) : null;
		if (serialized === prev) return;

		history = history.slice(0, historyIndex + 1);
		history.push(state);
		historyIndex += 1;
	}

	// 履歴番号を指定して盤面を復元
	function loadHistory(index) {
		if (index < 0 || index >= history.length) return;
		applyBoardState(history[index]);
		historyIndex = index;
	}

	// 重複チェック（行・列・3x3ブロック）とクリア判定
	function validateBoard() {
		cells.forEach(cell => cell.classList.remove('error'));

		const rowMap = Array.from({ length: 9 }, () => ({}));
		const colMap = Array.from({ length: 9 }, () => ({}));
		const blockMap = Array.from({ length: 9 }, () => ({}));

		cells.forEach((cell, idx) => {
			const val = getCellNumber(cell);
			if (!val) return;

			const row = Math.floor(idx / 9);
			const col = idx % 9;
			const block = Math.floor(row / 3) * 3 + Math.floor(col / 3);

			if (!rowMap[row][val]) rowMap[row][val] = [];
			if (!colMap[col][val]) colMap[col][val] = [];
			if (!blockMap[block][val]) blockMap[block][val] = [];

			rowMap[row][val].push(idx);
			colMap[col][val].push(idx);
			blockMap[block][val].push(idx);
		});

		function markConflicts(container) {
			container.forEach(map => {
				Object.values(map).forEach(indices => {
					if (indices.length > 1) {
						indices.forEach(i => cells[i].classList.add('error'));
					}
				});
			});
		}

		markConflicts(rowMap);
		markConflicts(colMap);
		markConflicts(blockMap);

		const complete = cells.every(cell => !!getCellNumber(cell) && !cell.classList.contains('error'));
		msg.textContent = complete ? '完成！おめでとうございます！' : '';
	}

	// JSONをダウンロード保存
	function downloadJson(data, filename) {
		const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	// JSONファイルを選択して読み込む共通処理
	function readJsonFile(onLoad) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = e => {
			const file = e.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = ev => {
				try {
					const data = JSON.parse(ev.target.result);
					onLoad(data);
				} catch {
					msg.textContent = 'JSON読込に失敗しました';
				}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function getSelectedOcrPreset() {
		if (!ocrPresetSelect) return 'auto';
		const value = (ocrPresetSelect.value || 'auto').trim();
		if (value === 'smartphone' || value === 'screenshot') return value;
		return 'auto';
	}

	function ensureOcrDebugArea() {
		let debugArea = document.getElementById('ocrDebugArea');
		if (!debugArea) {
			debugArea = document.createElement('div');
			debugArea.id = 'ocrDebugArea';
			debugArea.style.marginTop = '10px';
			debugArea.style.textAlign = 'center';
			msg.insertAdjacentElement('afterend', debugArea);
		}
		return debugArea;
	}

	function getAvailableOcrDebugImages() {
		return ocrDebugImages.filter(item => !!item.dataUrl);
	}

	function renderOcrDebugImage() {
		const debugArea = ensureOcrDebugArea();
		const available = getAvailableOcrDebugImages();
		if (available.length === 0) {
			debugArea.innerHTML = '';
			return;
		}

		if (ocrDebugIndex < 0 || ocrDebugIndex >= available.length) {
			ocrDebugIndex = 0;
		}

		const current = available[ocrDebugIndex];
		debugArea.innerHTML = '';

		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'center';
		header.style.alignItems = 'center';
		header.style.gap = '8px';
		header.style.marginBottom = '6px';

		const prevBtn = document.createElement('button');
		prevBtn.textContent = '<';
		prevBtn.style.minWidth = '28px';
		prevBtn.disabled = available.length <= 1;

		const title = document.createElement('div');
		title.textContent = `OCRデバッグ: ${current.title}`;
		title.style.fontSize = '0.9em';
		title.style.color = '#555';

		const nextBtn = document.createElement('button');
		nextBtn.textContent = '>';
		nextBtn.style.minWidth = '28px';
		nextBtn.disabled = available.length <= 1;

		prevBtn.addEventListener('click', () => {
			ocrDebugIndex = (ocrDebugIndex - 1 + available.length) % available.length;
			renderOcrDebugImage();
		});

		nextBtn.addEventListener('click', () => {
			ocrDebugIndex = (ocrDebugIndex + 1) % available.length;
			renderOcrDebugImage();
		});

		header.appendChild(prevBtn);
		header.appendChild(title);
		header.appendChild(nextBtn);

		const image = document.createElement('img');
		image.src = current.dataUrl;
		image.alt = `OCR ${current.key} preview`;
		image.style.maxWidth = '260px';
		image.style.border = '1px solid #b7d7c9';
		image.style.background = '#fff';

		debugArea.appendChild(header);
		debugArea.appendChild(image);
	}

	function setOcrDebugImage(key, dataUrl) {
		const target = ocrDebugImages.find(item => item.key === key);
		if (!target) return;
		target.dataUrl = dataUrl || '';
		const available = getAvailableOcrDebugImages();
		if (available.length > 0) {
			const targetIndex = available.findIndex(item => item.key === key);
			if (targetIndex >= 0) {
				ocrDebugIndex = targetIndex;
			}
		}
		renderOcrDebugImage();
		console.log(`[OCR] ${key === 'original' ? '選択画像' : '2値化画像'}プレビューを更新しました`);
	}

	function clearOcrDebugImages() {
		ocrDebugImages.forEach(item => {
			item.dataUrl = '';
		});
		ocrDebugIndex = 0;
		const debugArea = document.getElementById('ocrDebugArea');
		if (debugArea) {
			debugArea.innerHTML = '';
		}
	}


	// 初期値設定モード用UIの表示/非表示を切替
	function setSetupMode(enabled) {
		isSetupMode = enabled;
		fixedModeLabel.style.display = enabled ? '' : 'none';
		ocrBtn.style.display = enabled ? '' : 'none';
		startGameBtn.style.display = enabled ? '' : 'none';
	}

	// セル選択状態を解除
	function clearSelectionState() {
		selectedCell = null;
		cells.forEach(cell => {
			cell.classList.remove('selected');
			cell.classList.remove('highlight');
			cell.classList.remove('same-number');
			const memo = getMemoDiv(cell);
			if (memo) {
				Array.from(memo.children).forEach(span => span.classList.remove('same-number'));
			}
		});
	}

	// 数字色ラジオボタンの変更イベント
	// ※既存数字の色は変えず、次に入力する色だけを変更する
	document.querySelectorAll('input[name="numColor"]').forEach(radio => {
		radio.addEventListener('change', function () {
			if (this.checked) {
				msg.textContent = `入力色を${this.value.replace('color', '色')}に変更しました`;
			}
		});
	});

	// セルクリック: 選択＋自動入力ON時は即入力
	board.addEventListener('click', e => {
		if (!e.target.classList.contains('cell')) return;
		selectCell(e.target);
		if (autoInputMode && selectedNumber) {
			if (putNumber(e.target, selectedNumber)) {
				highlightRowCol(e.target);
				saveHistory();
			}
		}
	});

	// 数字ボタン: 選択状態更新＋（自動入力OFFの時のみ）選択セルに入力
	numberButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			const num = btn.textContent;
			// 自動入力ONで既に同じ数字が選択されている場合は選択解除
			if (autoInputMode && selectedNumber === num) {
				selectedNumber = null;
				numberButtons.forEach(b => b.classList.remove('selected'));
				// 選択解除時は強調もクリア
				if (selectedCell) {
					highlightRowCol(selectedCell);
				}
				return;
			}
			selectedNumber = num;
			setNumberButtonSelection(num);
			// 自動入力モードOFFの時のみ、数字ボタン押下で即座に入力
			if (!autoInputMode) {
				if (!selectedCell) return;
				if (putNumber(selectedCell, num)) {
					highlightRowCol(selectedCell);
					saveHistory();
				}
			} else {
				// 自動入力ONの場合は、選択セルがあれば強調を更新
				if (selectedCell) {
					highlightRowCol(selectedCell);
				}
			}
		});
	});

	// 仮置きモードのON/OFF
	pencilModeBtn.addEventListener('click', () => {
		pencilMode = !pencilMode;
		pencilModeBtn.classList.toggle('active', pencilMode);
	});

	// 自動入力モードのON/OFF
	autoInputBtn.addEventListener('click', () => {
		autoInputMode = !autoInputMode;
		autoInputBtn.classList.toggle('active', autoInputMode);
		// 自動入力ON時は数字ボタンの選択を解除
		if (autoInputMode) {
			selectedNumber = null;
			numberButtons.forEach(btn => btn.classList.remove('selected'));
		}
	});

	// 固定入力モード（初期値作成時のみ利用）
	if (fixedModeCheckbox) {
		fixedModeCheckbox.addEventListener('change', () => {
			fixedMode = fixedModeCheckbox.checked;
		});
	}

	// 履歴: 戻る/進む
	undoBtn.addEventListener('click', () => {
		if (historyIndex > 0) loadHistory(historyIndex - 1);
	});

	redoBtn.addEventListener('click', () => {
		if (historyIndex < history.length - 1) loadHistory(historyIndex + 1);
	});

	// 新規作成: 既存の固定数字を「固定予定（編集可能）」として残し、それ以外はクリア
	newGameBtn.addEventListener('click', () => {
		cells.forEach(cell => {
			if (cell.classList.contains('fixed')) {
				cell.classList.remove('fixed');
				if (getCellNumber(cell)) {
					cell.classList.add('input');
					setCellColorClass(cell, 'color1');
				}
			} else {
				clearCell(cell);
			}
		});
		clearSelectionState();
		setSetupMode(true);
		if (fixedModeCheckbox) {
			fixedModeCheckbox.checked = false;
			fixedMode = false;
		}
		msg.textContent = '固定数字を固定予定として残しました（編集可能）';
		validateBoard();
		saveHistory();
	});

	// リセット:
	// - 盤面編集モード: 全マスを空にする
	// - ゲームモード: 固定数字を残して、それ以外を空にする
	resetBoardBtn.addEventListener('click', () => {
		if (isSetupMode) {
			cells.forEach(cell => clearCell(cell));
			msg.textContent = '盤面をすべてリセットしました';
		} else {
			cells.forEach(cell => {
				if (!cell.classList.contains('fixed')) {
					clearCell(cell);
				}
			});
			msg.textContent = '固定数字以外をリセットしました';
		}
		clearSelectionState();
		validateBoard();
		saveHistory();
	});

	// ゲーム開始: 入っている数字を固定化して通常プレイモードへ
	startGameBtn.addEventListener('click', () => {
		validateBoard();
		const hasError = cells.some(cell => cell.classList.contains('error'));
		if (hasError) {
			msg.textContent = '重複エラーがあるためゲーム開始できません';
			return;
		}

		cells.forEach(cell => {
			if (getCellNumber(cell)) {
				cell.classList.add('fixed');
				cell.classList.remove('input');
				cell.classList.remove('num-color1', 'num-color2', 'num-color3');
			}
		});
		setSetupMode(false);
		if (fixedModeCheckbox) {
			fixedModeCheckbox.checked = false;
			fixedMode = false;
		}
		validateBoard();
		saveHistory();
		clearOcrDebugImages();
		msg.textContent = '';
	});

	// OCR画像読込: 画像から数字抽出して盤面へ反映
	ocrBtn.addEventListener('click', () => {
		// OCR起点: 画像ファイル選択
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = e => {
			const file = e.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = async ev => {
				clearOcrDebugImages();
				setOcrDebugImage('original', ev.target.result);
				const selectedPreset = getSelectedOcrPreset();
				const setOcrStatus = text => {
					msg.textContent = text;
					console.log(`[OCR] ${text}`);
				};

				const formatOcrErrorForStatus = error => {
					const errorText = error && error.message ? String(error.message) : String(error);
					if (errorText.startsWith('opencv-timeout:')) {
						return `高度OCR失敗(OpenCV待機): ${errorText}`;
					}
					if (errorText.startsWith('tesseract-timeout')) {
						return '高度OCR失敗(Tesseract待機): tesseract-timeout';
					}
					return `高度OCR失敗: ${errorText}`;
				};

				const setOcrBinaryPreview = binaryDataUrl => {
					setOcrDebugImage('binary', binaryDataUrl);
				};

				try {
					// 本処理: OpenCV前処理 + 盤面補正 + セルOCR
					if (!window.SudokuOCR || typeof window.SudokuOCR.run !== 'function') {
						throw new Error('ocr-module-not-loaded');
					}
					const nums = await window.SudokuOCR.run(ev.target.result, {
						onProgress: setOcrStatus,
						onDebugBinary: setOcrBinaryPreview,
						preset: selectedPreset
					});

					setOcrStatus('盤面へ反映中...');
					cells.forEach((cell, i) => {
						clearCell(cell);
						if (nums[i]) {
							cell.textContent = nums[i];
							cell.classList.add('fixed');
							cell.classList.remove('num-color1', 'num-color2', 'num-color3');
						}
					});
					validateBoard();
					saveHistory();
					const recognizedCount = nums.filter(v => /^[1-9]$/.test(v)).length;
					setOcrStatus(recognizedCount > 0 ? `画像読込が完了しました（${recognizedCount}マス認識）` : '数字を認識できませんでした');
				} catch (error) {
					console.error('[OCR] 高度OCRで失敗', error);
					setOcrStatus(formatOcrErrorForStatus(error));
				}
			};
			reader.readAsDataURL(file);
		};
		input.click();
	});

	// 一時保存機能（LocalStorage）
	function saveTemporaryBoard() {
		if (!confirm('現在の盤面を一時保存しますか？')) return;
		const state = getBoardState();
		localStorage.setItem('sudoku_temporary_save', JSON.stringify(state));
		msg.textContent = '盤面を一時保存しました';
		loadProgressBtn.disabled = false;
	}

	// 一時復元機能（LocalStorage）
	function loadTemporaryBoard() {
		if (!confirm('一時保存した盤面を復元しますか？')) return;
		const saved = localStorage.getItem('sudoku_temporary_save');
		if (!saved) {
			msg.textContent = '一時保存されたデータがありません';
			return;
		}
		try {
			const state = JSON.parse(saved);
			applyBoardState(state);
			msg.textContent = '盤面を一時復元しました';
		} catch (e) {
			msg.textContent = 'データの復元に失敗しました';
			console.error(e);
		}
	}

	// 一時保存ボタンのイベントリスナー
	saveProgressBtn.addEventListener('click', saveTemporaryBoard);

	// 一時復元ボタンのイベントリスナー
	loadProgressBtn.addEventListener('click', loadTemporaryBoard);

	// ページ開始時：一時保存データがあるかチェック
	function checkTemporarySave() {
		const saved = localStorage.getItem('sudoku_temporary_save');
		if (saved) {
			loadProgressBtn.disabled = false;
		} else {
			loadProgressBtn.disabled = true;
		}
	}

	// 初期値（fixedのみ）保存
	saveInitialBtn.addEventListener('click', () => {
		const initial = cells.map(cell => ({
			text: cell.classList.contains('fixed') ? cell.textContent : '',
			fixed: !!cell.classList.contains('fixed'),
			cellColor: getCellColorClass(cell),
			memo: null
		}));
		downloadJson({ type: 'initial', board: initial }, 'sudoku_initial.json');
	});

	// 初期値読込（読込値をfixedとして反映）
	loadInitialBtn.addEventListener('click', () => {
		readJsonFile(data => {
			const state = Array.isArray(data)
				? data.map(v => ({ text: v || '', fixed: !!v, cellColor: 'num-color1', memo: null, memoColor: 'memo-color1' }))
				: data.board;
			applyBoardState(state);
			validateBoard();
			saveHistory();
		});
	});

	// 初期表示: 履歴開始点を保存し、バリデーション実行、初期値設定モードを表示
	checkTemporarySave();
	saveHistory();
	validateBoard();
	setSetupMode(true);
});


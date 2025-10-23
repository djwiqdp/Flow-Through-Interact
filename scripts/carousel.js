(function(){
  const vp = document.getElementById('carouselViewport');
  if(!vp) return;

  let cards = Array.from(vp.querySelectorAll('.vcard'));

  // UI refs
  const playerEl = document.querySelector('.player');
  const playerBtn = document.querySelector('.player__btn');
  const playerTitleEl = document.getElementById('playerTitle');
  const playerAuthorEl = document.getElementById('playerAuthor');
  const playerCurrentTimeEl = document.getElementById('playerCurrentTime');
  const playerDurationEl = document.getElementById('playerDuration');
  const playerBarEl = document.getElementById('playerBar');
  const mainAudioPlayer = document.getElementById('mainAudioPlayer'); // Audio tag ref
  const recordCtaBtn = document.querySelector('.record-btn');

  // Modals
  const recordModal = document.getElementById('recordModal');
  const coverModal = document.getElementById('coverModal');
  const fromModal = document.getElementById('fromModal'); 
  const finalAlertModal = document.getElementById('finalAlertModal'); 
  const finalAlertTitle = document.getElementById('finalAlertTitle'); 
  const finalAlertCancelBtn = document.getElementById('finalAlertCancel'); 
  const finalAlertConfirmBtn = document.getElementById('finalAlertConfirm'); 
  const alertModal = document.getElementById('alertModal');
  const alertCancelBtn = document.getElementById('alertCancel');
  const alertConfirmBtn = document.getElementById('alertConfirm');

  // Record modal refs
  const modalRecordBtn = document.querySelector('.record-btn-modal');
  const modalRecordIcon = document.getElementById('modalRecordIcon');
  const recipientInput = document.getElementById('recipientInput');
  const modalCancelBtn = document.getElementById('modalCancel');
  const modalNextBtn = document.getElementById('modalNext');
  const currentTimeEl = document.getElementById('currentTime');
  const recordedDurationEl = document.getElementById('recordedDuration');
  const progressFillEl = document.getElementById('recordProgressFill');

  // Cover modal refs
  const coverModalCancelBtn = document.getElementById('coverModalCancel');
  const coverModalNextBtn = document.getElementById('coverModalNext');
  const imageOptions = document.querySelectorAll('.image-option');
  const finalCoverPreview = document.getElementById('finalCoverPreview');
  const webcamStreamEl = document.getElementById('webcamStream');
  const webcamCanvas = document.getElementById('webcamCanvas');
  const webcamPlaceholder = document.getElementById('webcamPlaceholder');
  const captureBtn = document.getElementById('captureBtn');

  // From modal refs
  const senderInput = document.getElementById('senderInput'); 
  const fromModalCancelBtn = document.getElementById('fromModalCancel'); 
  const fromModalSendBtn = document.getElementById('fromModalSend'); 

  // State variables for recording
  const maxRecordTime = 60;
  let recorder = null;
  let audioChunks = [];
  let audioBlob = null; // Recorded audio
  let mediaStream = null; // Microphone stream
  let recordingTimer = null;
  let recordedTimeSeconds = 0;
  let selectedCoverSrc = null;
  let webcamStream = null;
  let currentPlayingCard = null; // Currently playing vcard element
  let isPreviewing = false; // 녹음 모달에서 미리듣기 재생 중인지 여부
  let isRecording = false; // 👈 이 변수를 선언합니다.

  /* ---------- Utility Functions ---------- */
  function formatTime(s){
    const m = Math.floor(s/60);
    const r = Math.floor(s%60);
    return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  }

  /* ---------- Player Control (하단바) ---------- */
  function updatePlayerUI(card) {
    const title = card.querySelector('.vcard__title').textContent;
    const author = card.querySelector('.vcard__meta').textContent;
    const duration = parseInt(card.dataset.duration || 0, 10);
    const audioUrl = card.dataset.audioSrc;
    
    // 오디오 소스 설정 및 로드 (이전 클릭 시 작동 안 되는 문제 해결)
    if (mainAudioPlayer.src !== audioUrl) {
      mainAudioPlayer.src = audioUrl || '';
      mainAudioPlayer.load();
    }
    currentPlayingCard = card;

    playerTitleEl.textContent = title;
    playerAuthorEl.textContent = author;
    playerDurationEl.textContent = formatTime(duration);
    playerCurrentTimeEl.textContent = '00:00';
    playerBarEl.style.width = '0%';
    playerEl.setAttribute('aria-valuenow', 0);
    
    // 재생 상태가 아니라면 버튼 모양과 UI 리셋
    if (mainAudioPlayer.paused) {
      playerBtn.textContent = '▶';
      playerEl.classList.remove('is-playing');
      card.classList.remove('is-playing');
    }
  }

  function stopPlayback() {
    mainAudioPlayer.pause();
    mainAudioPlayer.currentTime = 0;
    
    playerBtn.textContent = '▶';
    playerEl.classList.remove('is-playing');
    playerCurrentTimeEl.textContent = '00:00';
    playerBarEl.style.width = '0%';
    playerEl.setAttribute('aria-valuenow', 0);

    if (currentPlayingCard) {
      currentPlayingCard.classList.remove('is-playing');
      currentPlayingCard = null;
    }
  }

  function toggleMainPlayback() {
    // 녹음 모달 미리듣기 재생 중이면 중지
    if (isPreviewing) stopPreviewPlayback(); 
    
    // 현재 중앙 카드 가져오기
    const centerCard = cards[2];

    // 중앙 카드에 오디오 소스가 없다면 (e.g. Placeholder), 작동하지 않음
    if (!centerCard || !centerCard.dataset.audioSrc) return;
    
    // 오디오 소스가 메인 플레이어에 설정되어 있는지 확인 및 설정 (회전 후 초기 재생 대응)
    if (mainAudioPlayer.src !== centerCard.dataset.audioSrc) {
        updatePlayerUI(centerCard);
    }
    
    if (mainAudioPlayer.paused) {
      mainAudioPlayer.play().catch(e => console.error("Audio playback error:", e));
      playerBtn.textContent = '||';
      playerEl.classList.add('is-playing');
      if (centerCard) {
          centerCard.classList.add('is-playing');
          currentPlayingCard = centerCard;
      }
    } else {
      mainAudioPlayer.pause();
      playerBtn.textContent = '▶';
      playerEl.classList.remove('is-playing');
      currentPlayingCard?.classList.remove('is-playing');
    }
  }

  // Audio Player Event Handlers
  mainAudioPlayer.addEventListener('timeupdate', () => {
    const currentTime = mainAudioPlayer.currentTime;
    // mainAudioPlayer.duration이 로드되지 않았을 경우를 대비하여 card.dataset.duration 사용
    const duration = mainAudioPlayer.duration || parseInt(currentPlayingCard?.dataset.duration, 10) || 0;
    const progress = (duration > 0) ? (currentTime / duration) * 100 : 0;

    playerCurrentTimeEl.textContent = formatTime(currentTime);
    playerBarEl.style.width = `${progress}%`;
    playerEl.setAttribute('aria-valuenow', Math.round(progress));
  });

  mainAudioPlayer.addEventListener('ended', () => {
      // 재생 완료 시 정지 상태로
      mainAudioPlayer.pause();
      mainAudioPlayer.currentTime = 0;
      playerBtn.textContent = '▶';
      playerEl.classList.remove('is-playing');
      currentPlayingCard?.classList.remove('is-playing');
      // UI를 현재 중앙 카드의 시작 상태로 리셋
      if (currentPlayingCard) {
        updatePlayerUI(currentPlayingCard);
      }
  });

  // 메인 플레이어 버튼 클릭 이벤트: 토글 기능
  playerBtn?.addEventListener('click', toggleMainPlayback);

  /* ---------- Carousel & Card Logic ---------- */
  function applyStates(){
    cards.forEach((c,i)=>{
      c.classList.remove('vcard--center','vcard--near','vcard--far','vcard--active');

      if(i===2){
        c.classList.add('vcard--center','vcard--active');
        c.setAttribute('aria-current','true');
        c.removeAttribute('aria-hidden');
        const media = c.querySelector('.vcard__media');
        media?.classList.add('vcard__media--center');
        
        // Update player for the new center card
        updatePlayerUI(c); 
        
        // Ensure playing state is correct
        if(currentPlayingCard === c && !mainAudioPlayer.paused) c.classList.add('is-playing');
      }else{
        c.removeAttribute('aria-current');
        (i===1 || i===3) ? c.classList.add('vcard--near') : c.classList.add('vcard--far');
        c.setAttribute('aria-hidden', (i===0 || i===4) ? 'true' : 'false');
        const media = c.querySelector('.vcard__media');
        media?.classList.remove('vcard__media--center');
        c.classList.remove('is-playing'); // remove playing state from side cards
      }
    });
  }

  function rotate(dir){
    stopPlayback(); // Stop playback on card rotation
    if(dir>0){
      const first = cards.shift(); cards.push(first); vp.appendChild(first);
    }else{
      const last = cards.pop(); cards.unshift(last); vp.insertBefore(last, vp.firstChild);
    }
    cards = Array.from(vp.querySelectorAll('.vcard'));
    applyStates();
  }

  // Arrows
  document.querySelectorAll('.cta-arrow').forEach(btn=>{
    btn.addEventListener('click', ()=> rotate(Number(btn.dataset.dir || 1)));
  });

  // Click card to center/play
  vp.addEventListener('click', (e)=>{
    const card = e.target.closest('.vcard');
    if(!card) return;
    
    // Voice Playback button
    if(e.target.closest('.pill')){
      if(card.classList.contains('vcard--center')){
        // 중앙 카드일 경우: 메인 플레이어 토글
        toggleMainPlayback();
      } else {
        // 중앙 카드가 아닐 경우: 중앙으로 이동 후 재생 시작
        const idx = cards.indexOf(card);
        const shift = idx - 2;
        if(shift === 0) return; // 이미 중앙일 때

        // 1. 회전 및 오디오/UI 업데이트
        if(shift>0){ for(let i=0;i<shift;i++) rotate(1); }
        else if(shift<0){ for(let i=0;i<Math.abs(shift);i++) rotate(-1); }
        
        // 2. 회전 애니메이션 이후 재생 시작
        setTimeout(()=> {
          const newCenter = cards[2];
          if(newCenter === card) {
            // 오디오 소스가 있다면 재생 시작
            if (newCenter.dataset.audioSrc) {
                toggleMainPlayback(); 
            }
          }
        }, 300); // Wait for rotation animation
      }
      return;
    }

    // Regular card click for centering
    const idx = cards.indexOf(card);
    if(idx===-1) return;
    const shift = idx - 2;
    if(shift>0){ for(let i=0;i<shift;i++) rotate(1); }
    else if(shift<0){ for(let i=0;i<Math.abs(shift);i++) rotate(-1); }
    else applyStates();
  });


  /* ---------- Record Modal Logic (Real Recording) ---------- */
  
  // 미리듣기 일시정지 로직
  function stopPreviewPlayback() {
      mainAudioPlayer.pause();
      mainAudioPlayer.currentTime = 0;
      modalRecordIcon.src = './assets/images/play.png';
      currentTimeEl.textContent = '00:00';
      progressFillEl.style.width = '0%';
      isPreviewing = false;
      
      // mainAudioPlayer의 이벤트 리스너 제거 (중복 방지 및 모달에만 적용)
      mainAudioPlayer.removeEventListener('ended', stopPreviewPlayback);
  }
  
  // Request microphone permission on open
  recordCtaBtn?.addEventListener('click', async ()=>{
    recordModal?.classList.add('is-active');
    document.body.style.overflow = 'hidden';
    resetRecordModal();
    
    stopPlayback(); // 메인 플레이어 중지
    
    try {
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("마이크 접근 허용됨.");
      }
      modalRecordBtn.disabled = false; // 마이크 접근 허용 시 버튼 활성화
    } catch(e) {
      alert("마이크 접근이 필요합니다. 설정을 확인해주세요.");
      console.error('마이크 접근 오류:', e);
      modalRecordBtn.disabled = true;
    }
  });
  
  function resetRecordModal(){
    if(recordingTimer) clearInterval(recordingTimer);
    if(recorder && recorder.state !== 'inactive') recorder.stop();
    
    isRecording = false; // 👈 상태 리셋
    audioBlob = null; 
    audioChunks = [];
    recordedTimeSeconds = 0;
    isPreviewing = false;
    
    recipientInput.value = '';
    modalRecordIcon.src = './assets/images/play.png'; 
    modalNextBtn.disabled = true;
    currentTimeEl.textContent = '00:00';
    recordedDurationEl.textContent = '00:00';
    progressFillEl.style.width = '0%';
    progressFillEl.style.transition = 'width .1s linear';
    
    // Clear playback preview if running
    mainAudioPlayer.src = '';
    mainAudioPlayer.load();
    mainAudioPlayer.removeEventListener('ended', stopPreviewPlayback);
  }

  function startRecording() {
    if (!mediaStream) return;
    
    stopPlayback(); // Stop main playback if running
    stopPreviewPlayback(); // 미리듣기 중이면 중지
    
    // Start recording UI
    isRecording = true; // 👈 상태 설정
    recordedTimeSeconds = 0;
    modalRecordIcon.src = './assets/images/record.png'; // 녹음 중 아이콘
    modalNextBtn.disabled = true;
    recordedDurationEl.textContent = formatTime(maxRecordTime);
    progressFillEl.style.transition = 'width 1s linear';

    // Start MediaRecorder
    // MP3 대신 일반적으로 지원되는 audio/webm 또는 audio/ogg 사용 권장
    const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus') ? 'audio/webm; codecs=opus' : 'audio/webm';
    try {
      recorder = new MediaRecorder(mediaStream, { mimeType });
    } catch (e) {
      console.error('MediaRecorder 생성 오류:', e);
      recorder = new MediaRecorder(mediaStream); // 대체 수단
    }

    audioChunks = [];
    recorder.ondataavailable = e => {
        if(e.data.size > 0) audioChunks.push(e.data);
    };
    
    recorder.onstop = () => {
      // 녹음 중지 시 blob 생성
      const finalBlobType = audioChunks[0]?.type || 'audio/webm'; // 실제 저장된 타입 사용
      audioBlob = new Blob(audioChunks, { type: finalBlobType }); 
      
      // Calculate duration from metadata
      const tempAudio = new Audio(URL.createObjectURL(audioBlob));
      tempAudio.addEventListener('loadedmetadata', function updateDuration() {
        recordedTimeSeconds = Math.round(tempAudio.duration);
        recordedDurationEl.textContent = formatTime(recordedTimeSeconds);
        modalNextBtn.disabled = recordedTimeSeconds < 1; // 1초 미만 녹음 시 전송 불가
        tempAudio.removeEventListener('loadedmetadata', updateDuration);
        
        // 녹음 완료 후 초기 UI 상태 업데이트
        modalRecordIcon.src = './assets/images/play.png'; // 재생 가능 아이콘
        progressFillEl.style.width = '0%';
        currentTimeEl.textContent = '00:00';
        progressFillEl.style.transition = 'width .1s linear';
      });
    };

    recorder.start();
    
    // Start timer for UI update and max duration check
    recordingTimer = setInterval(() => {
      recordedTimeSeconds++;
      currentTimeEl.textContent = formatTime(recordedTimeSeconds);
      progressFillEl.style.width = `${(recordedTimeSeconds / maxRecordTime) * 100}%`;
      
      if(recordedTimeSeconds >= maxRecordTime){
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    if (!isRecording || !recorder || recorder.state === 'inactive') return;
    
    if (recordingTimer) clearInterval(recordingTimer);
    isRecording = false; // 👈 상태 설정

    if (recorder.state === 'recording') {
        recorder.stop();
    }
  }

  // 녹음 모달 버튼 클릭 이벤트: 녹음 시작/중지 또는 미리듣기 토글
  function toggleRecordPlayback() {
    if (isRecording) {
      // 1. 녹음 중: 녹음 중지
      stopRecording();
    } else if (audioBlob) {
      // 2. 녹음 완료 상태: 미리듣기 토글
      if (mainAudioPlayer.paused || !isPreviewing) {
        // 2-1. 재생 시작
        if (mainAudioPlayer.src !== URL.createObjectURL(audioBlob)) {
            mainAudioPlayer.src = URL.createObjectURL(audioBlob);
            mainAudioPlayer.load();
        }
        
        // timeupdate 리스너는 매 재생 시마다 추가하는 것보다 한 번만 추가하고 UI 업데이트를 처리하는 것이 효율적이지만, 
        // 여기서는 미리듣기 UI 처리를 위해 모달 내에서만 사용되는 mainAudioPlayer의 이점을 살려 재생 로직에 추가
        const previewTimeUpdate = () => {
          const currentTime = mainAudioPlayer.currentTime;
          const duration = mainAudioPlayer.duration || recordedTimeSeconds; 
          const progress = (duration > 0) ? (currentTime / duration) * 100 : 0;
          
          currentTimeEl.textContent = formatTime(currentTime);
          progressFillEl.style.width = `${progress}%`;
        };
        
        mainAudioPlayer.addEventListener('timeupdate', previewTimeUpdate);
        mainAudioPlayer.addEventListener('ended', () => {
             stopPreviewPlayback();
             mainAudioPlayer.removeEventListener('timeupdate', previewTimeUpdate); // 재생 완료 시 제거
        });

        const playPromise = mainAudioPlayer.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            modalRecordIcon.src = './assets/images/record.png'; // 재생 중 아이콘
            isPreviewing = true;
          }).catch(e => {
            console.error("미리듣기 재생 오류:", e);
            // 자동 재생 정책 등으로 인해 재생이 실패하면 아이콘을 리셋
            modalRecordIcon.src = './assets/images/play.png';
            isPreviewing = false;
          });
        }
        
      } else {
        // 2-2. 재생 중: 일시정지 (stopPreviewPlayback이 정지/리셋을 모두 처리)
        stopPreviewPlayback();
      }
    } else {
      // 3. 녹음 시작 (audioBlob이 없고 녹음 중이 아닐 때)
      startRecording();
    }
  }

  modalRecordBtn?.addEventListener('click', toggleRecordPlayback);


  // Cancel modal -> alert
  modalCancelBtn?.addEventListener('click', ()=> alertModal?.classList.add('is-active'));

  // Alert actions
  alertCancelBtn?.addEventListener('click', ()=> alertModal?.classList.remove('is-active'));
  alertConfirmBtn?.addEventListener('click', ()=>{
    alertModal?.classList.remove('is-active');
    recordModal?.classList.remove('is-active');
    document.body.style.overflow = '';
    
    // Stop and reset all
    stopPlayback();
    stopPreviewPlayback(); // 미리듣기도 중지
    resetRecordModal();
    resetCoverModal();
    resetFromModal();
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
  });

  // Click overlay to confirm close (similar to cancel)
  recordModal?.addEventListener('click', (e)=>{
    if(e.target === recordModal){
      if(isRecording || isPreviewing) {
          stopRecording(); // 녹음 중이라면 중지
          stopPreviewPlayback(); // 미리듣기 중이라면 중지
      }
      alertModal?.classList.add('is-active');
    }
  });


  /* ---------- Cover modal logic and subsequent steps ---------- */
  function resetCoverModal(){
    selectedCoverSrc = null;
    coverModalNextBtn.disabled = true;
    finalCoverPreview.style.backgroundImage = 'none';
    imageOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Default image selection logic
    const def = document.querySelector('.image-option[data-src="./assets/images/sample1.png"]');
    if(def){
      def.classList.add('selected');
      selectedCoverSrc = def.dataset.src;
      finalCoverPreview.style.backgroundImage = `url('${selectedCoverSrc}')`;
      coverModalNextBtn.disabled = false;
    }
    stopWebcam();
  }

  // go next from record -> cover
  modalNextBtn?.addEventListener('click', ()=>{
    if(modalNextBtn.disabled) return;
    recordModal?.classList.remove('is-active');
    coverModal?.classList.add('is-active');
    resetCoverModal();
    startWebcam();
  });

  // image pick
  imageOptions.forEach(option=>{
    option.addEventListener('click', ()=>{
      imageOptions.forEach(o=>o.classList.remove('selected'));
      webcamCanvas?.classList.remove('selected');
      option.classList.add('selected');
      selectedCoverSrc = option.dataset.src;
      finalCoverPreview.style.backgroundImage = `url('${selectedCoverSrc}')`;
      coverModalNextBtn.disabled = false;
    });
  });

  /* ---------- Webcam (Square Crop) ---------- */
  async function startWebcam(){
    if(webcamStream) return;
    try{
      webcamStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } });
      webcamStreamEl.srcObject = webcamStream;
      webcamStreamEl.style.display = 'block';
      webcamPlaceholder.style.display = 'none';
      webcamCanvas.style.display = 'none';
      captureBtn.style.display = 'flex';
    }catch(e){
      console.error('웹캠 접근 오류:', e);
      webcamPlaceholder.alt = '웹캠을 켤 수 없습니다.';
    }
  }
  function stopWebcam(){
    if(webcamStream){
      webcamStream.getTracks().forEach(t=>t.stop());
      webcamStream = null;
    }
    webcamStreamEl.srcObject = null;
    webcamStreamEl.style.display = 'none';
    webcamPlaceholder.style.display = 'block';
    webcamCanvas.style.display = 'none';
    captureBtn.style.display = 'flex';
  }
  
  // 1:1 이미지 크롭 로직
  function captureImage(){
    if(!webcamStream || webcamStreamEl.style.display==='none') return null;

    const videoW = webcamStreamEl.videoWidth;
    const videoH = webcamStreamEl.videoHeight;
    const size = Math.min(videoW, videoH); // 1:1 정사각형 크기
    
    // 중앙 크롭 위치 계산
    const sx = (videoW - size) / 2;
    const sy = (videoH - size) / 2;

    // 캔버스 크기를 1:1로 설정
    webcamCanvas.width = size;
    webcamCanvas.height = size;
    
    const ctx = webcamCanvas.getContext('2d');
    
    // 중앙 크롭하여 캔버스에 그리기
    ctx.drawImage(webcamStreamEl, sx, sy, size, size, 0, 0, size, size); 
    
    const dataUrl = webcamCanvas.toDataURL('image/png');
    webcamStreamEl.style.display = 'none';
    webcamCanvas.style.display = 'block';
    return dataUrl;
  }

  captureBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const imageDataUrl = captureImage();
    if(imageDataUrl){
      imageOptions.forEach(opt=>opt.classList.remove('selected'));
      webcamCanvas.classList.add('selected');
      selectedCoverSrc = imageDataUrl;
      finalCoverPreview.style.backgroundImage = `url('${selectedCoverSrc}')`;
      coverModalNextBtn.disabled = false;
    }
  });

  webcamCanvas?.addEventListener('click', ()=>{
    if(webcamCanvas.style.display==='block'){
      imageOptions.forEach(opt=>opt.classList.remove('selected'));
      webcamCanvas.classList.add('selected');
      selectedCoverSrc = webcamCanvas.toDataURL('image/png'); 
      finalCoverPreview.style.backgroundImage = `url('${selectedCoverSrc}')`;
      coverModalNextBtn.disabled = false;
    }
  });

  // back to record
  coverModalCancelBtn?.addEventListener('click', ()=>{
    stopWebcam();
    coverModal?.classList.remove('is-active');
    recordModal?.classList.add('is-active');
  });

  // go next from cover -> from (보내는 사람)
  coverModalNextBtn?.addEventListener('click', ()=>{
    if(coverModalNextBtn.disabled) return;
    coverModal?.classList.remove('is-active');
    fromModal?.classList.add('is-active');
    resetFromModal();
  });

  /* ---------- From modal logic ---------- */
  function resetFromModal(){
    senderInput.value = '';
    fromModalSendBtn.disabled = true;
  }

  // From input validation
  senderInput?.addEventListener('input', ()=>{
    fromModalSendBtn.disabled = senderInput.value.trim() === '';
  });

  // From cancel -> back to cover
  fromModalCancelBtn?.addEventListener('click', ()=>{
    fromModal?.classList.remove('is-active');
    coverModal?.classList.add('is-active');
  });

  // From send -> final confirm
  fromModalSendBtn?.addEventListener('click', ()=>{
    if(fromModalSendBtn.disabled || !recipientInput.value || !senderInput.value) return;
    
    finalAlertTitle.textContent = `${recipientInput.value}님께 목소리를 전달할까요?`;
    
    fromModal?.classList.remove('is-active');
    finalAlertModal?.classList.add('is-active');
  });

  // Final confirm cancel -> back to from
  finalAlertCancelBtn?.addEventListener('click', ()=>{
    finalAlertModal?.classList.remove('is-active');
    fromModal?.classList.add('is-active');
  });

  // Final confirm send -> add card & reset
  finalAlertConfirmBtn?.addEventListener('click', async ()=>{
    if(!audioBlob) return; 

    finalAlertModal?.classList.remove('is-active');
    document.body.style.overflow = '';
    
    const data = {
      title: `${recipientInput.value}에게 전하는 보이스`,
      author: senderInput.value,
      // 이미지와 오디오 Blob을 서버로 전송해야 함
      imageBlob: selectedCoverSrc, // Base64 Data URL (웹캠 이미지의 경우) 또는 URL (기본 이미지의 경우)
      audioBlob: audioBlob, // MediaRecorder에서 생성된 실제 오디오 Blob
      duration: recordedTimeSeconds 
    };

    // ----------------------------------------------------------------------
    // [!!! 서버 전송 로직이 들어갈 자리 !!!]
    // 
    // TODO: 
    // 1. FormData를 생성하여 data.imageBlob, data.audioBlob, data.title 등을 담습니다.
    // 2. fetch 또는 Axios를 사용하여 서버의 API 엔드포인트로 POST 요청을 보냅니다.
    // 3. 서버 전송이 성공하면 서버에서 반환한 최종 URL을 사용하여 addCard를 호출합니다.
    // ----------------------------------------------------------------------
    console.log("데이터를 서버로 전송 시도 중... (현재는 브라우저 내부에만 저장됩니다.)");
    
    // 현재는 임시 URL을 사용하여 카드 추가 (새로고침하면 사라짐)
    const localData = {
        title: data.title,
        author: data.author,
        imageUrl: selectedCoverSrc,
        audioUrl: URL.createObjectURL(audioBlob),
        duration: recordedTimeSeconds
    };
    
    addCard(localData);

    // ----------------------------------------------------------------------
    
    // Final cleanup
    stopPlayback();
    stopPreviewPlayback();
    resetRecordModal();
    resetCoverModal();
    resetFromModal();

    // Stop mic stream after final send
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
  });


  /* ---------- Add card & animate to center ---------- */
  function addCard(data){
    const newCard = document.createElement('article');
    newCard.classList.add('vcard');
    newCard.setAttribute('data-idx', String(cards.length));
    newCard.setAttribute('tabindex','0');
    newCard.setAttribute('data-audio-src', data.audioUrl);
    newCard.setAttribute('data-duration', data.duration); 

    const mediaStyle = `background-image:url('${data.imageUrl}')`;

    newCard.innerHTML = `
      <header class="vcard__header">
        <h3 class="vcard__title">${data.title}</h3>
        <small class="vcard__meta">${data.author}</small>
      </header>
      <div class="vcard__media" style="${mediaStyle}"></div>
      <button class="pill" type="button">보이스 듣기</button>
    `;

    // remove first, append new to end and rotate twice to center
    const first = cards.shift();
    if(first) vp.removeChild(first);
    cards.push(newCard); vp.appendChild(newCard);

    rotate(1); rotate(1);

    cards = Array.from(vp.querySelectorAll('.vcard'));

    const center = cards[2];
    center.style.transition = 'transform .4s cubic-bezier(.68,-.55,.27,1.55), opacity .4s';
    center.style.transform = 'scale(1.2) translateY(-5px)';
    center.style.opacity = '0';
    requestAnimationFrame(()=> {
      center.style.transform = '';
      center.style.opacity = '1';
      setTimeout(()=>{ center.style.transition = '' }, 400);
    });

    applyStates();
  }

  // init
  applyStates();
  window.addEventListener('resize', applyStates);
})();
(() => {
  const button = document.getElementById('internalReviewBtn');
  if (!button) return;

  fetch('/api/internal-access', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store'
  })
    .then((response) => {
      if (!response.ok) throw new Error('access check failed');
      return response.json();
    })
    .then((data) => {
      if (data && data.allowed === true) {
        button.hidden = false;
      }
    })
    .catch(() => {
      // 판별 실패 시에는 안전하게 버튼을 계속 숨김
      button.hidden = true;
    });

  button.addEventListener('click', () => {
    alert('허용된 IP에서 접속했습니다.\n중장기배치계획 검토 기능을 연결할 준비가 되었습니다.');
  });
})();

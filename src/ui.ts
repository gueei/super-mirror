type StatusPayload = {
  type: 'status';
  message: string;
  canMirror: boolean;
};

const mirrorButton = document.getElementById('mirror') as HTMLButtonElement;
const cancelButton = document.getElementById('cancel') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLDivElement;

mirrorButton.addEventListener('click', () => {
  parent.postMessage({ pluginMessage: { type: 'mirror' } }, '*');
});

cancelButton.addEventListener('click', () => {
  parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*');
});

window.onmessage = (event: MessageEvent<{ pluginMessage?: StatusPayload }>) => {
  const message = event.data.pluginMessage;

  if (!message || message.type !== 'status') {
    return;
  }

  statusElement.textContent = message.message;
  mirrorButton.disabled = !message.canMirror;
};

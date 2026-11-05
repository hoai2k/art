import { platform } from './platform.js';

try {
  // The SDK preloads cloud progress before main.js reads the saved game.
  await platform.init();
  await import('./main.js');
} catch (error) {
  console.error('CrazyGames startup failed', error);
  document.body.classList.remove('booting');
  document.querySelector('#title').hidden = true;
  const panel = document.querySelector('#booting');
  panel.style.display = 'grid';
  panel.style.placeContent = 'center';
  panel.replaceChildren();
  const message = document.createElement('p');
  message.textContent = 'The theatre could not connect. Please reload to try again.';
  const reload = document.createElement('button');
  reload.textContent = 'Reload';
  reload.onclick = () => location.reload();
  panel.append(message, reload);
}

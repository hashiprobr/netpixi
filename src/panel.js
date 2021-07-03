import * as PIXI from 'pixi.js';

import save from './save';


export default function (filename, zoom, settings, vertices, areas, main, app, warn) {
    function createButton(text) {
        const button = document.createElement('button');
        button.style.width = 'min-content';
        button.style.margin = '.5rem';
        button.style.fontSize = '11px';
        button.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
        button.style.lineHeight = 1;
        button.innerHTML = text;
        return button;
    }

    function enableButtons() {
        main.style.pointerEvents = 'auto';
        animationButton.disabled = false;
        settingsButton.disabled = false;
        networkButton.disabled = false;
        imageButton.disabled = false;
        videoButton.disabled = false;
    }

    function disableButtons() {
        main.style.pointerEvents = 'none';
        animationButton.disabled = true;
        settingsButton.disabled = true;
        networkButton.disabled = true;
        imageButton.disabled = true;
        videoButton.disabled = true;
    }

    const animationButton = createButton('Load Animation');
    animationButton.addEventListener('click', () => {
    });

    const settingsButton = createButton('Load Settings');
    settingsButton.addEventListener('click', () => {
    });

    const networkButton = createButton('Save Network');
    networkButton.addEventListener('click', () => {
        function initialize() {
            disableButtons();
        }
        function finalize() {
            enableButtons();
        }
        save(filename, settings, vertices, areas, initialize, finalize, warn);
    });

    const imageButton = createButton('Save Image');
    imageButton.addEventListener('click', () => {
        const bounds = app.stage.getBounds();
        const scale = zoom / 100;
        const width = bounds.width + 2 * scale * settings.graph.borderX;
        const height = bounds.height + 2 * scale * settings.graph.borderY;
        const texture = PIXI.RenderTexture.create(width, height);
        const graphics = new PIXI.Graphics()
            .beginFill(settings.graph.color, settings.graph.alpha)
            .drawRect(0, 0, width + 1, height + 1)
            .endFill();
        app.renderer.render(graphics, texture, false);
        const tx = scale * settings.graph.borderX - bounds.x;
        const ty = scale * settings.graph.borderY - bounds.y;
        const matrix = new PIXI.Matrix(1, 0, 0, 1, tx, ty);
        app.renderer.render(app.stage, texture, false, matrix);
        const image = app.renderer.plugins.extract.image(texture, 'image/png', 1);
        const a = document.createElement('a');
        a.setAttribute('href', image.src);
        a.setAttribute('download', `${filename}.png`);
        a.click();
        a.remove();
        texture.destroy();
    });

    const videoButton = createButton('Save Video');
    videoButton.addEventListener('click', () => {
    });
    videoButton.style.display = 'none';

    const topPanel = document.createElement('div');
    topPanel.style.display = 'flex';
    topPanel.appendChild(animationButton);
    topPanel.appendChild(settingsButton);
    topPanel.appendChild(networkButton);
    topPanel.appendChild(imageButton);
    topPanel.appendChild(videoButton);

    let playing = false;

    const playButton = document.createElement('a');
    playButton.style.margin = '.25rem .5rem .5rem .75rem';
    playButton.style.textDecoration = 'none';
    playButton.style.userSelect = 'none';
    playButton.style.cursor = 'pointer';
    playButton.innerHTML = '▶';
    playButton.addEventListener('click', () => {
        if (playing) {
            playButton.innerHTML = '▶';
            playing = false;
        } else {
            playing = true;
            playButton.innerHTML = '⏸';
        }
    });

    const range = document.createElement('input');
    range.type = 'range';
    range.style.flexGrow = 1;

    const bottomPanel = document.createElement('div');
    bottomPanel.style.display = 'none';
    bottomPanel.appendChild(playButton);
    bottomPanel.appendChild(range);

    return [topPanel, bottomPanel];
}

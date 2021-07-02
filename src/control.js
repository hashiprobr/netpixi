import save from './save';


export default function (filename, settings, vertices, areas, warn) {
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

    const animationButton = createButton('Load Animation');
    animationButton.addEventListener('click', () => {
    });

    const settingsButton = createButton('Load Settings');
    settingsButton.addEventListener('click', () => {
    });

    const networkButton = createButton('Save Network');
    networkButton.addEventListener('click', () => {
        function initialize() {
            networkButton.disabled = true;
        }
        function finalize() {
            networkButton.disabled = false;
        }
        save(filename, settings, vertices, areas, initialize, finalize, warn);
    });

    const imageButton = createButton('Save Image');
    imageButton.addEventListener('click', () => {
    });

    const videoButton = createButton('Save Video');
    videoButton.addEventListener('click', () => {
    });
    videoButton.disabled = true;

    const control = document.createElement('div');
    control.appendChild(animationButton);
    control.appendChild(settingsButton);
    control.appendChild(networkButton);
    control.appendChild(imageButton);
    control.appendChild(videoButton);
    return control;
}

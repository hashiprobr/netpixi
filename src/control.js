import save from './save';


export default function (filename, settings, vertices, areas, warn) {
    function createButton(text, click) {
        const button = document.createElement('button');
        button.style.width = 'min-content';
        button.style.margin = '.5rem';
        button.innerHTML = text;
        button.addEventListener('click', click);
        return button;
    }

    const downloadButton = createButton('Save Network', () => {
        try {
            save(filename, settings, vertices, areas);
        } catch (error) {
            warn(error);
        }
    });

    const control = document.createElement('div');
    control.appendChild(downloadButton);
    return control;
}

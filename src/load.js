import { useInflate } from './zipnet';


function seek(file, process) {
    return new Promise((response) => {
        const inflate = useInflate(process, response);

        const chunkSize = 16384;

        function read(begin, end) {
            const reader = new FileReader();

            reader.addEventListener('load', () => {
                inflate.push(new Uint8Array(reader.result));
                const nextEnd = end + chunkSize;
                if (nextEnd < file.size) {
                    read(end, nextEnd, false);
                } else {
                    read(end, file.size, true);
                }
            });

            reader.addEventListener('error', () => {
                throw reader.error;
            });

            reader.readAsArrayBuffer(file.slice(begin, end));
        }

        read(0, chunkSize);
    });
}


function stream(body, process) {
    return new Promise((response) => {
        const inflate = useInflate(process, response);

        const reader = body.getReader();

        function read() {
            reader.read().then(pipe);
        }

        function pipe({ done, value }) {
            if (done) {
                inflate.push(new Uint8Array(), true);
                return;
            }
            inflate.push(value, false);
            read();
        }

        read();
    });
}


function loadLocal(process) {
    return new Promise((response) => {
        const input = document.createElement('input');
        input.type = 'file';

        input.addEventListener('input', () => {
            seek(input.files[0], process)
                .then(response);
        });

        input.click();
    });
}


function loadRemote(path, process) {
    const uri = window.location.pathname;
    const left = uri.indexOf('/', 1);
    const right = uri.lastIndexOf('/') + 1;
    const prefix = uri.slice(left, right);

    return fetch(`/files${prefix}${path}`)
        .then((response) => {
            if (!response.ok) {
                throw response.statusText;
            }
            return stream(response.body, process);
        });
}


export { loadLocal, loadRemote };

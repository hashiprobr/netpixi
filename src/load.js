import { useInflate } from './zipnet';


function seek(file, process) {
    return new Promise((resolve, reject) => {
        const push = useInflate(process, resolve);

        const chunkSize = 16384;

        function read(begin, end) {
            const reader = new FileReader();

            reader.addEventListener('load', () => {
                try {
                    const flush = end >= file.size;
                    push(new Uint8Array(reader.result), flush);
                    if (!flush) {
                        read(end, end + chunkSize);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            reader.addEventListener('error', () => {
                reject(reader.error);
            });

            reader.readAsArrayBuffer(file.slice(begin, end));
        }

        read(0, chunkSize);
    });
}


function stream(body, process) {
    return new Promise((resolve, reject) => {
        const push = useInflate(process, resolve);

        const reader = body.getReader();

        function read() {
            reader.read()
                .then(pipe)
                .catch(reject);
        }

        function pipe({ done, value }) {
            if (done) {
                push(new Uint8Array(), true);
                return;
            }
            push(value, false);
            read();
        }

        read();
    });
}


function loadLocal(initialize, process) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';

        input.addEventListener('input', () => {
            initialize();
            seek(input.files[0], process)
                .then(resolve)
                .catch(reject);
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

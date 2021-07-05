import { useInflate } from './zipnet';


function seek(file, process) {
    return new Promise((response, reject) => {
        const push = useInflate(process, response);

        const chunkSize = 16384;

        function read(begin, end) {
            const reader = new FileReader();

            reader.addEventListener('load', () => {
                try {
                    push(new Uint8Array(reader.result));
                    const nextEnd = end + chunkSize;
                    if (nextEnd < file.size) {
                        read(end, nextEnd, false);
                    } else {
                        read(end, file.size, true);
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
    return new Promise((response) => {
        const push = useInflate(process, response);

        const reader = body.getReader();

        function read() {
            reader.read().then(pipe);
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


function loadLocal(process) {
    return new Promise((response, reject) => {
        const input = document.createElement('input');
        input.type = 'file';

        input.addEventListener('input', () => {
            seek(input.files[0], process)
                .then(response)
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

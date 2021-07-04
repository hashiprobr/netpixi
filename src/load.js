import pako from 'pako';


function loadLocal(process, finalize, warn) {
    const input = document.createElement('input');
    input.type = 'file';

    input.addEventListener('input', () => {
        let buffer = '';
        const inflate = new pako.Inflate({ to: 'string' });
        inflate.onData = (chunk) => {
            buffer += chunk;
            let begin = 0;
            let index;
            while ((index = buffer.indexOf('\n', begin)) !== -1) {
                process(buffer.slice(begin, index));
                begin = index + 1;
            }
            buffer = buffer.slice(begin);
        };
        inflate.onEnd = (status) => {
            if (status === 0) {
                if (buffer.length > 0) {
                    process(buffer);
                }
                finalize();
            } else {
                if (inflate.msg.length === 0) {
                    warn('Invalid ZipNet file');
                } else {
                    warn(inflate.msg);
                }
            }
        };

        const chunkSize = 16384;
        const file = input.files[0];
        function read(begin, end, flush) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                inflate.push(new Uint8Array(reader.result), flush);
                if (!flush) {
                    pipe(end, end + chunkSize);
                }
            });
            reader.addEventListener('error', () => {
                warn(reader.error);
            });
            reader.readAsArrayBuffer(file.slice(begin, end));
        }
        function pipe(begin, end) {
            if (end < file.size) {
                read(begin, end, false);
            } else {
                read(begin, file.size, true);
            }
        }
        pipe(0, chunkSize);
    });

    input.click();
}


function loadRemote(path, initialize, process, finalize, exit) {
    const start = Date.now();

    const uri = window.location.pathname;
    const left = uri.indexOf('/', 1);
    const right = uri.lastIndexOf('/') + 1;
    const prefix = uri.slice(left, right);

    fetch(`/files${prefix}${path}`)
        .then((response) => {
            if (!response.ok) {
                throw response.statusText;
            }

            initialize();

            let buffer = '';
            const inflate = new pako.Inflate({ to: 'string' });
            inflate.onData = (chunk) => {
                buffer += chunk;
                let begin = 0;
                let index;
                while ((index = buffer.indexOf('\n', begin)) !== -1) {
                    process(buffer.slice(begin, index));
                    begin = index + 1;
                }
                buffer = buffer.slice(begin);
            };
            inflate.onEnd = (status) => {
                if (status === 0) {
                    if (buffer.length > 0) {
                        process(buffer);
                    }
                    finalize();
                    console.log(`Loaded in ${(Date.now() - start) / 1000} seconds`);
                } else {
                    if (inflate.msg.length === 0) {
                        throw 'Invalid ZipNet file';
                    } else {
                        throw inflate.msg;
                    }
                }
            };

            const reader = response.body.getReader();
            function pipe({ done, value }) {
                if (done) {
                    inflate.push(new Uint8Array(), true);
                    return;
                }
                inflate.push(value, false);
                reader.read().then(pipe).catch(exit);
            }
            reader.read().then(pipe).catch(exit);
        })
        .catch(exit);
}


export { loadLocal, loadRemote };

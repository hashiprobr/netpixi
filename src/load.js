import pako from 'pako';


export default function (path, initialize, process, finalize, exit) {
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
                if (status !== 0) {
                    throw inflate.err;
                }
                if (buffer.length > 0) {
                    process(buffer);
                }
                finalize();
                console.log(`${(Date.now() - start) / 1000} seconds`);
            };

            const reader = response.body.getReader();
            function pipe({ done, value }) {
                if (done) {
                    inflate.push(null, true);
                    return;
                }
                inflate.push(value, false);
                reader.read().then(pipe).catch(exit);
            }
            reader.read().then(pipe).catch(exit);
        })
        .catch(exit);
}

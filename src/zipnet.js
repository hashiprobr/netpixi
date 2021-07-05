import pako from 'pako';


function useInflate(process, response) {
    const inflate = new pako.Inflate({ to: 'string' });

    let buffer = '';

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
            response();
        } else {
            if (inflate.msg.length === 0) {
                throw 'Invalid ZipNet file';
            } else {
                throw inflate.msg;
            }
        }
    };

    return inflate;
}


function useDeflate() {
}


export { useInflate, useDeflate };

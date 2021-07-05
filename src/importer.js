import { loadLocal } from './load';


function importProperties() {
    function process(data) {
        console.log(data);
    }
    return loadLocal(process);
}


function importAnimation() {
    function process(data) {
        console.log(data);
    }
    return loadLocal(process);
}


export { importProperties, importAnimation };

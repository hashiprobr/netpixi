import { loadLocal } from './load';


function loadProperties(warn) {
    function process(value) {
    }
    function finalize() {
    }
    loadLocal(process, finalize, warn);
}


function loadAnimation(warn) {
    function process(value) {
    }
    function finalize() {
    }
    loadLocal(process, finalize, warn);
}


export { loadProperties, loadAnimation };

function compare(a, b) {
    if (Math.abs(a - b) < 0.000001) {
        return 0;
    }
    if (a < b) {
        return -1;
    }
    return 1;
}

const areNotEqual = (a, b) => a !== b;
const areNotClose = (a, b) => compare(a, b) !== 0;

const isBoolean = (value) => typeof value === 'boolean';
const isFinite = (value) => typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
const isNonNegative = (value) => isFinite(value) && compare(value, 0) >= 0;
const isPositive = (value) => isFinite(value) && compare(value, 0) > 0;
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;
const isColor = (value) => Number.isInteger(value) && value >= 0x000000 && value <= 0xffffff;
const isAlpha = (value) => isNonNegative(value) && compare(value, 1) <= 0;
const isString = (value) => typeof value === 'string';
const isObject = (value) => typeof value === 'object';
const isArray = (value) => Array.isArray(value);
const isShape = (value) => ['circle', 'star', 'square', 'diamond', 'uptriangle', 'downtriangle'].includes(value);

const differences = {
    graph: {
        directed: areNotEqual,
        hborder: areNotClose,
        vborder: areNotClose,
        color: areNotEqual,
        alpha: areNotClose,
        alpha0: areNotClose,
        alpha1: areNotClose,
        alpha2: areNotClose,
        kscale: areNotClose,
        vscale: areNotClose,
        vfamily: areNotEqual,
        lshift: areNotClose,
        lfamily: areNotEqual,
    },
    vertex: {
        size: areNotClose,
        color: areNotEqual,
        shape: areNotEqual,
        bwidth: areNotClose,
        bcolor: areNotEqual,
        kfamily: areNotEqual,
    },
    edge: {
        width: areNotClose,
        color: areNotEqual,
        alpha: areNotClose,
        curve1: areNotClose,
        curve2: areNotClose,
        lparam: areNotClose,
    },
};

const conditions = {
    settings: {
        graph: isObject,
        vertex: isObject,
        edge: isObject,
    },
    graph: {
        directed: isBoolean,
        hborder: isNonNegative,
        vborder: isNonNegative,
        color: isColor,
        alpha: isAlpha,
        alpha0: isAlpha,
        alpha1: isAlpha,
        alpha2: isAlpha,
        kscale: isPositive,
        vscale: isPositive,
        vfamily: isString,
        lshift: isNonNegative,
        lfamily: isString,
    },
    vertex: {
        size: isPositive,
        color: isColor,
        shape: isShape,
        bwidth: isNonNegative,
        bcolor: isColor,
        kfamily: isString,
    },
    edge: {
        width: isPositive,
        color: isColor,
        alpha: isAlpha,
        curve1: isFinite,
        curve2: isFinite,
        lparam: isAlpha,
    },
    frame: {
        graph: isObject,
        vertices: isArray,
        edges: isArray,
    },
};

export { compare, isFinite, isPositive, isNonNegativeInteger, isString, isObject, differences, conditions };

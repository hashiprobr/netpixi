function compare(a, b) {
    if (Math.abs(a - b) < 0.000001) {
        return 0;
    }
    if (a < b) {
        return -1;
    }
    return 1;
}

const isBoolean = (value) => typeof value === 'boolean';
const isNumber = (value) => typeof value === 'number' && !Number.isNaN(value);
const isFinite = (value) => isNumber(value) && Number.isFinite(value);
const isNonNegative = (value) => isFinite(value) && compare(value, 0) >= 0;
const isPositive = (value) => isFinite(value) && compare(value, 0) > 0;
const isColor = (value) => Number.isInteger(value) && value >= 0x000000 && value <= 0xffffff;
const isAlpha = (value) => isNonNegative(value) && compare(value, 1) <= 0;

const conditions = {
    graph: {
        directed: isBoolean,
        borderX: isNonNegative,
        borderY: isNonNegative,
        color: isColor,
        alpha: isAlpha,
        edgeFade: isAlpha,
        edgeScale: isPositive,
        vertexScale: isPositive,
    },
    vertex: {
        size: isPositive,
        color: isColor,
        alpha: isAlpha,
    },
    edge: {
        width: isPositive,
        color: isColor,
        alpha: isAlpha,
        curve1: isFinite,
        curve2: isFinite,
    },
};

export { compare, isNumber, conditions };

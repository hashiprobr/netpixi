const isBoolean = (value) => typeof value === 'boolean';
const isNumber = (value) => typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
const isNonNegative = (value) => isNumber(value) && value >= 0;
const isPositive = (value) => isNumber(value) && value > 0;
const isColor = (value) => Number.isInteger(value) && value >= 0x000000 && value <= 0xffffff;
const isAlpha = (value) => isNonNegative(value) && value <= 1;

const conditions = {
    graph: {
        directed: isBoolean,
        borderX: isNonNegative,
        borderY: isNonNegative,
        vertexScale: isPositive,
        edgeScale: isPositive,
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
        outAlpha: isAlpha,
        curve1: isNumber,
        curve2: isNumber,
    },
};

export { isBoolean, isNumber, conditions };

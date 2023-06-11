
export type TokenListType = 'FILE' | 'URL';

export const isIntegerString = (str: string): boolean => {
    return /^[+-]?[0-9]+$/.test(str);
};

export const isFractionString = (str: string): boolean => {
    const fractionSplit = str.split('/');
    if (fractionSplit.length == 2) {
        return (
            isIntegerString(fractionSplit[0]) && isIntegerString(fractionSplit[1])
        );
    }
    return false;
};

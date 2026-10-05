export const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

export const getInitials = (name) => {
    if (!name) return "";

    const words = name.split(" ");
    let initials = "";

    for (let i = 0; i < Math.min(words.length, 2); i++) {
        initials += words[i][0];
    }

    return initials.toUpperCase();
}

export const addThousandsSeparator = (value) => {
    if (value === null || value === undefined) return "0";
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return "0";
    return numberValue.toLocaleString();
}
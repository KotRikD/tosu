export const argumetsParser = (argumentsString: string[] | string) => {
    const args: { [key: string]: any } = {};

    if (typeof argumentsString === 'string') {
        const regex = /(?:--|-)(?<name>[^=\s]+)(?:[= ](?<value>(?!--|-)\S*))?/g;
        const matches = [...argumentsString.matchAll(regex)];
        matches.forEach((match) => {
            const name = match?.groups?.name || '';
            const value: any = match?.groups?.value || '';

            if (!isNaN(parseFloat(value))) args[name] = parseFloat(value);
            else if (value === 'true') args[name] = true;
            else if (value === 'false') args[name] = false;
            else args[name] = value;
        });

        return args;
    }

    const regex = /(?:--|-)(?<name>[^=\s]+)(?:[= ](?<value>(?!--|-)\S*))?/;
    for (let i = 0; i < argumentsString.length; i++) {
        const arg = argumentsString[i];

        if (!regex.test(arg)) continue;
        const groups = regex.exec(arg)?.groups;

        const name = groups?.name || '';
        const value: any = groups?.value || '';

        if (!isNaN(parseFloat(value))) args[name] = parseFloat(value);
        else if (value === 'true') args[name] = true;
        else if (value === 'false') args[name] = false;
        else args[name] = value;
    }

    return args;
};

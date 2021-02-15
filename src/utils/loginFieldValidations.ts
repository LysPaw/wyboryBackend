export const loginFieldValidation = (username: string | null, password: string | null, activationCode?: string) => {
  if (username !== null) {
    if (username.length !== 6 || !/^[A-Z]*$/.test(username.substring(0, 2)) || !/\d+$/.test(username.substring(2, 6))) {
      // checking if length is equal to 6 and if 1st 2 letters in username are uppercase with at least 4 characters are numbers
      return errorObject('username');
    }
  }

  if (password !== null) {
    if (
      password.length < 8 ||
      password.length >= 20 || //checking if length of password is between 8 and 20 characters
      !/\d/.test(password) || // if contains numbers
      !/[A-Z]/.test(password) || // if contains at least one uppercase
      !/[@#*^\$&]/.test(password) // if contains special character
    ) {
      return errorObject('password');
    }
  }

  if (activationCode) {
    if (activationCode.length !== 8) {
      return errorObject('activationCode', 'activation code');
    }
  }

  return null;
};

export const errorObject = (field: string, stringField?: string) => {
  return [
    {
      field,
      message: `Incorrect ${stringField ? stringField : field}.`,
    },
  ];
};

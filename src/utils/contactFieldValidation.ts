export const contactFieldValidation = (phoneNumber: string | null, emailAdress: string | null) => {
    if (phoneNumber !== null && phoneNumber !== '') {
        if(phoneNumber.length !== 9 || !/^\d+$/.test(phoneNumber!)) {
            return {
              errors: [
                {
                  field: 'phoneNumber',
                  message: 'Incorrect number.'
                }
              ]
            }
          }
    }
  
    if (emailAdress !== null && emailAdress !== '') {
        if(!emailAdress.includes('@')) {
            return {
              errors: [
                {
                  field: 'emailAdress',
                  message: 'Incorrect email.'
                }
              ]
            }
          }
    }
  
    return null;
  };
  
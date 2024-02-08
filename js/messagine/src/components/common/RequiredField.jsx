import { Warning } from '@phosphor-icons/react';

function RequiredField( props ) {

  let { validationText } = props;
  
  if ( !validationText ) validationText = 'this field is required';

  return (

    <span className="shift-up2 ml-3 text-red size-80">&nbsp;&nbsp;<Warning />&nbsp;{validationText}</span>

  );

}

export default RequiredField;
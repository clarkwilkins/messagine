import { Form } from 'react-bootstrap';
import RequiredField from './RequiredField';
const DOMPurify = require ( 'dompurify' )( window )

function TextInput ( props ) {

  let {
    className,
    disabled,
    errors,
    handleKeyDown,
    inputName,
    label,
    onBlur,
    onChange,
    placeholder,
    register,
    type,
    validationText
  } = props;

  className += " p-3"

  if ( !type ) type = 'text';
  
  return (

    <Form.Group className="mb-3">
                          
      <div className="size-65 text-muted mb-1" >
        <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize( label ) }}></span>
        {errors && ( <RequiredField validationText={validationText} /> ) }
      </div>
                  
      <Form.Control
        className={className}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        type={type}
        { ...register( inputName, { onBlur, onChange }) }
      />

    </Form.Group>

  );

}

export default TextInput;
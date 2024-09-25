import { Form } from 'react-bootstrap';
import RequiredField from './RequiredField';

function TextArea ( props ) {

let {
  className,
  disabled,
  errors,
  inputName,
  label,
  onChange,
  placeholder,
  register,
  validationText
} = props;

if ( !className ) className = 'p-3 h-150';

  return (

    <Form.Group className="mb-3">
                          
      <Form.Label className="size-65 text-muted">
        {label}
        {errors && ( <RequiredField validationText={validationText} /> ) }
      </Form.Label>
                  
      <Form.Control
        as="textarea"
        className={className}
        disabled={disabled}
        placeholder={placeholder}
        { ...register( inputName, { onChange }) }
      />

    </Form.Group>

  );

}

export default TextArea;
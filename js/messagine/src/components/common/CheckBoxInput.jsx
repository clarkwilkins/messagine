import { Form } from 'react-bootstrap';

function CheckboxInput ( props ) {

let {
  className,
  disabled,
  inputName,
  label,
  onChange,
  register
} = props;

  if (!className ) className = "mb-3"

  return (

    <Form.Group className={className}>

      <Form.Check
        disabled={disabled}
        label={label}
        type="checkbox"
        { ...register( inputName, { onChange } ) }
      />

    </Form.Group>

  );

}

export default CheckboxInput;
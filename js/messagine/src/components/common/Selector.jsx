import { Form } from 'react-bootstrap';
import RequiredField from "./RequiredField";

function Selector ( props ) {

  let {
    complex,
    disabled,
    errors,
    inputName,
    label,
    onChange,
    placeholder,
    register,
    validationText,
    values
  } = props;

  return (

    <Form.Group className="mb-3">
          
      <Form.Label className="size-65 text-muted">
        {label}
        {errors && ( <RequiredField validationText={validationText} /> )}
      </Form.Label>
                  
      <Form.Select 
        className="p-3"
        disabled={disabled}
        { ...register( inputName, { onChange }) }
      >

        {placeholder && ( 

          <option
            key="-1"
            value = ""
          >
            {placeholder}
          </option>

        ) }
    
        {values && !complex && Object.entries( values ).map( ( theRow, key ) => {
    
          return ( 
                        
            <option 
              key={key}
              value={theRow[0]}
            >
              {theRow[1]}
            </option>
                        
          ); 
          
        }) }

        {values && complex && Object.values( values ).map( ( theRow, key ) => { 

          let {
            label,
            value
          } = theRow;

          return ( 
                        
            <option 
              key={key}
              value={value}
            >
              {label}
            </option>
                        
          );

        }) }

    
      </Form.Select>
    
    </Form.Group>

  );

}

export default Selector;
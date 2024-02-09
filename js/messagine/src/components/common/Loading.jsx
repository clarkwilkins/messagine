import { Spinner } from 'react-bootstrap';

function Loading( props ) {

  let { 
    className,
    message 
  } = props;

  if ( !message ) message = 'loading...';

  return (

    <div className={className}>
      
      <Spinner 
        animation="border" 
        variant="secondary" 
      /><span className="size-80">{ " " }{message}</span>

    </div>

  );

}

export default Loading;
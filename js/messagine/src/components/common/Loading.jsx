import { Spinner } from 'react-bootstrap';

function Loading( props ) {

  let { message } = props;

  if ( !message ) message = 'loading...';

  return (

    <>
      
      <Spinner 
        animation="border" 
        variant="secondary" 
      /><span className="size-80">{ " " }{message}</span>

    </>

  );

}

export default Loading;
import {  
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Col,
  Container,
  Row
} from 'react-bootstrap';
import ErrorBoundary from '../common/ErrorBoundary';
import InfoAlert from '../common/InfoAlert';
import Loading from '../common/Loading';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';

function DryRunComponent({ handleError }) {

  const nowRunning = 'scheduler/DryRun.jsx';

  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  
  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    loaded: false,
    dryRunResults: {}
  });

  const {
    dryRunResults,
    loaded 
  } = state;

  const dryRun = useCallback(async () => {

    const context = `${nowRunning}.dryRun`;
    const loadingMessage = 'loading the dry run...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'scheduler/run';
      const payload = { dryRun: true };
      const { data } = await apiLoader({ api, payload });
      const {
        allCampaignsProcessedResults,
        failure,
        success
      } = data;
      
      if (!success) {

        await handleError({ 
          failure,
          nowRunning: context, 
          userId
        });
        return {};

      }

      setState((prevState) => ({
        ...prevState,
        dryRunResults: allCampaignsProcessedResults
      }));

      removeLoadingMessage(loadingMessage);

    } catch(error) {

      await handleError({ 
        error,
        nowRunning: context,
        userId
      });

    }

  }, [addLoadingMessage, handleError, removeLoadingMessage, userId]);

  const showCampaigns = () => {

    const context = `${nowRunning}.showCampaigns`;

    try {

      const displayData = dryRunResults.map(campaignResult => {

        const {
          campaignName,
          dryRunInformation,
          noEligibleRecipients
        } = campaignResult


        let recipientsCount = 0

        if (dryRunInformation) recipientsCount = dryRunInformation.length

        let recipientsMessage = recipientsCount + ' recipient'

        if (recipientsCount > 1) recipientsMessage += 's'
        
        return(

          <div className="width-100 size-80 mt-3">

            <Row className="mb-2">

              <Col xs={12} sm={6}>
              
                <div className="size-80">campaign</div>
                
                <div>{campaignName}</div>

              </Col>

              <Col xs={12} sm={6}>
              
                <div className="size-80">eligible recipients</div>
                
                <div>
                  {noEligibleRecipients === true && (<span>no eligible recipients on this run</span>)}
                  {recipientsCount > 0 && (<span>{recipientsMessage}</span>)}
                </div>

              </Col>

            </Row>

            {recipientsCount > 0 && (

              <Container className="width-100 border-gray-2 mt-3">

                {dryRunInformation.map(row => {

                  const {
                    contactName,
                    email,
                    messageContent,
                    messageId,
                    messageSubject
                  } = row

                  return(
                  
                    <Row className="alternate-1 p-3">

                      <div className="size-65">messageId: {messageId}</div>
                      <div>to: {contactName} &lt;{email}&gt;</div>
                      <div>subject: {messageSubject}</div>
                      <div dangerouslySetInnerHTML={{ __html: messageContent }}></div>

                    </Row>

                  )

                })}
              </Container>

            )}

          </div>
        )

      })

      return displayData

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`
    
    const runThis = async () => {

      try {

        if (!loaded) {

            await dryRun() 
            setState((prevState) => ({
              ...prevState,
              loaded: true
            }));      

        }

      } catch (error) {

        await handleError({ 
          error,
          nowRunning: context,
          userId
        });
      
      }

    }

    runThis()

  }, [dryRun, handleError, loaded, userId]);

  try {
    
    // Final setup before rendering.

    const campaignsRun = Object.keys(dryRunResults).length;
    const message = `${campaignsRun} campaign ${campaignsRun !== 1 ? 's' : ''} were part of this dry run.`;

    return (
    
      <>

        {!loaded && (<Loading className="loading" message="loading the dry run results..." />)}

        {loaded && (
          
          <>

            <InfoAlert message={message} />

            {campaignsRun > 0 && (showCampaigns())}

          </>

       )}

      </>

    );

  } catch(error) {

    handleError({ 
      error,
      nowRunning,
      userId
    });

  }

}

export default function DryRun(props) {

  const defaultProps = {
    ...props,
    defaultError: "The dry run tool isn't working right now.",
    errorNumber: 61
  };

  return (

    <ErrorBoundary
      context="DryRun.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <DryRunComponent {...defaultProps} />
    </ErrorBoundary>

  )

}
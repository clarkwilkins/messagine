import {
  useCallback,
  useEffect,
  useState
} from 'react';
import { 
  Link,
  useOutletContext 
} from 'react-router-dom';
import { 
  Breadcrumb,
  Container,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import moment from 'moment';
import { PlusSquare } from '@phosphor-icons/react';
import ErrorBoundary from '../common/ErrorBoundary';
import InfoAlert from '../common/InfoAlert';
import Loading from '../common/Loading'; 
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';
const { intervals } = require('../../assets/json/static.json');

function ManageCampaignsComponent({ handleError }) {

  const nowRunning = 'ManageCampaigns.jsx';
  changeTitle('messagine: manage campaigns');
  
  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    campaigns: {},
    loaded: false
  });

  const { 
    campaigns,
    loaded, 
  } = state;

  const loadCampaigns = useCallback(async () => {

    const context =  `${nowRunning}.loadCampaigns`;
    const loadingMessage = 'loading campaigns...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/all';
      const payload = {};
      const { data } = await apiLoader({ api, payload });
      const {
        campaigns,
        failure,
        success
      } = data;

      if (!success) {

        handleError({
          error: failure,
          nowRunning: context,
          userId
        });
        return null;

      }

      setState((prevState) => ({
        ...prevState,
        campaigns
      })); 

      removeLoadingMessage(loadingMessage);
      setState((prevState) => ({
        ...prevState,
        loaded: true
      }));


    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  }, [addLoadingMessage, handleError, removeLoadingMessage, userId]);
  
  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {
    
      if (!loaded) {

        try {

          await loadCampaigns();

          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));

        } catch(error) {

          handleError({
            error,
            nowRunning: context,
            userId
          });

        }

      }

    };

    runThis();

  }, [handleError, loadCampaigns, loaded, userId]);

  try {

    console.log(campaigns);
    const count = Object.keys(campaigns).length;


    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the campaign manager..." />)}


        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>campaigns</Breadcrumb.Item>
              <Breadcrumb.Item>manage</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      create a campaign
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="/campaigns/new"><PlusSquare /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              manage campaigns

            </h5>

            {count < 1 && (<InfoAlert message="There are no campaigned defined. Use the new campaign link above to get started." />)}

            {count > 0 && (
              
              <Container className="border-gray-2 size-80 mt-3 mb-2">

                {Object.entries(campaigns).map(([campaignId, campaign]) => {

                  let {
                    campaignName,
                    interval,
                    nextRun,
                    starts
                  } = campaign;
                  
                  return (

                    <Row 
                      key={campaignId} 
                      className="alternate-1 p-3"
                    >

                      <Link to={`/campaigns/edit/${campaignId}`}>

                        <div>{campaignName}</div>

                        <div className="size-80">
                          runs {intervals[interval]} 
                          {interval > 2 && (
                            <span>
                              {" " }on {moment.unix(nextRun).format('dddd')}s
                            </span>
                          )}@{moment.unix(starts).format('h:mm a')}
                          , next run {nextRun < moment().format('X') ? 'within the hour' : moment.unix(nextRun).fromNow()}
                        </div>

                      </Link>

                    </Row>
                  )

                })}                
                
              </Container>

            )}
            
          </>

        )}

      </>

    );

  } catch (error) {

    handleError({ 
      error,
      nowRunning,
      userId
    });

  }

}

export default function ManageCampaigns(props) {

  const defaultProps = {
    ...props,
    defaultError: "The campaign manager isn't working right now.",
    errorNumber: 66
  };

  return (

    <ErrorBoundary
      context="ManageCampaigns.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <ManageCampaignsComponent {...defaultProps} />
    </ErrorBoundary>

  );

}

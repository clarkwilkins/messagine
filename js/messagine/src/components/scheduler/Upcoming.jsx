import {  
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import moment from 'moment';
import { 
  Breadcrumb,
  Col,
  Container,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { 
  List,
  PersonSimpleRun
} from '@phosphor-icons/react';
import DryRun from './DryRun';
import ErrorBoundary from '../common/ErrorBoundary';
import Loading from '../common/Loading';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';;
const { intervals } = require('../../assets/json/static.json');

function UpcomingComponent({ handleError }) {

  const nowRunning = 'scheduler/Upcoming.jsx';
  changeTitle ('messagine: upcoming sends');

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
    showDryRun: false,
    upcoming: {}
  });

  const { loaded, showDryRun, upcoming } = state;

  const getUpcoming = useCallback(async () => {

    const context = `${nowRunning}.getUpcoming`;
    const loadingMessage = 'loading the upcoming schedule...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'scheduler/upcoming';
      const payload = {};
      const { data } = await apiLoader({ api, payload });
      const {
        failure,
        success,
        upcoming
      } = data;

      if (!success) {

        handleError({ 
          failure, 
          nowRunning: context, 
          userId 
        });
        return null;

      }

      setState((prevState) => ({
        ...prevState,
        upcoming
      }));

      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });

    }

  }, [addLoadingMessage, handleError, removeLoadingMessage, userId]);

  const toggleDryRun = () => setState((prevState) => ({
    ...prevState,
    showDryRun: !prevState.showDryRun
  }));

  const upcomingList = () => {

    const context = `${nowRunning}.upcomingList`;

    try {

      const rows = Object.entries(upcoming).map((row, key) => {

        const campaignId = row[0];
        const {
          campaignName,
          campaignTargets,
          ends2,
          interval,
          messageId,
          messageName,
          nextRun,
          nextRun2,
          starts2
        } = row[1];
        const campaignLink = `../campaigns/edit/${campaignId}`;
        const messageLink = `../campaigns/edit/${campaignId}/${messageId}`;

        return (

          <Row
            className="alternate-1 p-3"
            key={key}
          >

            <Col xs={12} sm={6}>

              <a href={campaignLink}>
            
                <div className="size-80">campaign</div>

                <div>{campaignName}</div>

              </a>
              
            </Col>

            <Col xs={12} sm={6}>
            
              <div>
                
                <div className="size-80">lifecycle</div>

                <div>{starts2} &#8212; {ends2}</div>

              </div>
              
            </Col>

            <Col xs={12} sm={6}>

              <div>
              
                <div className="size-80">interval</div>

                <div>{intervals[interval]}</div>

              </div>
              
            </Col>

            <Col xs={12} sm={6}>
            
              <div>
                
                <div className="size-80">next run</div>

                <div>{nextRun2} &#8212; {moment.unix(nextRun).fromNow()}</div>

              </div>
              
            </Col>

            <Col xs={12} sm={6}>

              <a href={messageLink}>
                
                <div className="size-80">next message</div>

                <div>{messageName}</div>

              </a>
              
            </Col>

            <Col xs={12} sm={6}>
                            
              <div className="size-80">targets</div>

              <div>{Object.keys(campaignTargets).length}</div>
              
            </Col>

          </Row>

        );

      });

      return rows;

    } catch(error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });

    }

  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;
    
    const runThis = async () => {

      try {

        if (!loaded) {

          await getUpcoming();
          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));

        }

      } catch (error) {

        handleError({ 
          error,
          nowRunning: context,
          userId
        });
      
      }

    };

    runThis();

  }, [getUpcoming, handleError, loaded, userId]);

  try {

    const upcomingEvents = Object.keys(upcoming).length;

    return (
    
      <>

        {!loaded && (<Loading className="loading" message="loading the lists manager..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>scheduler</Breadcrumb.Item>
              <Breadcrumb.Item>upcoming</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      show schedule
                    </Tooltip>
                 )}
                  placement="bottom"
                >

                  <a href="./upcoming"><List /></a>
                  
                </OverlayTrigger>
                
              </div>

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      {!showDryRun && (<span>dry-run the schedule</span>)}
                      {showDryRun && (<span>hide dry-run results</span>)}
                    </Tooltip>
                 )}
                  placement="bottom"
                >
                  <div onClick={ () => toggleDryRun() }><PersonSimpleRun /></div>
                </OverlayTrigger>
                
              </div>
              
              upcoming scheduled events ({upcomingEvents} campaign{upcomingEvents !== 1 &&(<span>s</span>)})

            </h5>

            {upcomingEvents && (<Container className="mt-3 mb-3 border-gray-2 size-80 width-100">{upcomingList()}</Container>)}

            {showDryRun && (<DryRun/>)}

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

export default function Upcoming(props) {

  const defaultProps = {
    ...props,
    defaultError: "The upcoming campaigns tool isn't working right now.",
    errorNumber: 53
  };

  return (

    <ErrorBoundary
      context="Upcoming.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <UpcomingComponent {...defaultProps} />
    </ErrorBoundary>

  );

}

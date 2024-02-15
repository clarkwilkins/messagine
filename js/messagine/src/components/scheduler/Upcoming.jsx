import { 
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom'
import moment from 'moment'
import { 
  Breadcrumb,
  Col,
  Container,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap'
import { List } from '@phosphor-icons/react'
import Loading from '../common/Loading'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler'
const { intervals } = require('../../assets/json/static.json')

function Upcoming() {

  const nowRunning = 'scheduler/Upcoming.jsx'
  changeTitle ('messagine: upcoming sends')

  const defaultError = "The upcoming schedule tool isn't working right now"
  const [errorState, setErrorState] = useState({
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 53, // this is only useful when there are child components
    message: defaultError,
    number: 53,
    occurred: false,
  })
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [upcoming, setUpcoming] = useState({})

  const getUpcoming = useCallback(async () => {

    const context = `${nowRunning}.getScheduled`

    try {

      const api = 'scheduler/upcoming'
      const payload = {}
      const { data } = await apiLoader({ api, payload })
      const {
        failure,
        success,
        upcoming
      } = data

      if (!success) {

        if (level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          alreadyReported: true,
          context,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null
    
      }

      setUpcoming(upcoming)
      return null

    } catch(e) {

      if (level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        alreadyReported: false,
        occurred: true
      }))

    }

  }, [level, toggleDimmer])

  const upcomingList = () => {

    const rows = Object.entries(upcoming).map((row, key) => {

      const campaignId = row[0]
      const {
        campaignName,
        ends2,
        interval,
        messageId,
        messageName,
        nextRun,
        nextRun2,
        starts2,
        targets
      } = row[1]
      const campaignLink = `../campaigns/edit/${campaignId}`
      const messageLink = `../campaigns/edit/${campaignId}/${messageId}`

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
            
            <div>
              
              <div className="size-80">targets</div>

              <div>{targets}</div>

            </div>
            
          </Col>

        </Row>

      )

    })

    return rows

  }

  useEffect(() => {

    const context = `${nowRunning}.useEffect`
    
    const runThis = async () => {

        try {

          if (!loading) {

              setLoading(true) // only do this once!          
              toggleDimmer(true)
              await getUpcoming()

              setLoaded(true)
              toggleDimmer(false)

          }

        } catch (e) {

        if (level === 9) console.log(`exception: ${e.message}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
            ...prevState,
            context,
            details: e.message,
            errorAlreadyReported: false,
            occurred: true
        }))
        setLoaded(true)
        
        }

      }

      runThis()

  }, [getUpcoming, level, loading, toggleDimmer])

  try {
    
    // setup for error display and (possible) reporting

    let reportError = false; // default condition is there is no error
    const {
      alreadyReported,
      context,
      details,
      message: errorMessage,
      errorNumber,
      occurred: errorOccurred
    } = errorState

    if (errorOccurred && !alreadyReported) reportError = true; // persist this error to the Simplexable API

    // final setup before rendering

    console.log('upcoming', upcoming)
    const upcomingEvents = Object.keys(upcoming).length

    return (
    
      <>

        {errorOccurred && (

          errorDisplay({
            context,
            details,
            errorMessage,
            errorNumber,
            nowRunning,
            reportError
          })

       )}

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
              
              upcoming scheduled events ({upcomingEvents} campaign{upcomingEvents !== 1 &&(<span>s</span>)})

            </h5>

            {upcomingEvents && (<Container className="mt-3 mb-3 border-gray-2 size-80">{upcomingList()}</Container>)}

          </>

       )}

      </>

   )

  } catch(e) {

    if (level === 9) console.log(`exception: ${e.message}`)

    toggleDimmer(false)
    setErrorState(prevState => ({
      ...prevState,
      context: nowRunning,
      details: e.message,
      errorAlreadyReported: false,
      occurred: true
    }))

  }

}

export default Upcoming;
import {  
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom'
import { 
  Col,
  Container,
  Row
} from 'react-bootstrap'
import InfoAlert from '../common/InfoAlert'
import Loading from '../common/Loading'
import { apiLoader } from '../../services/handler'

function DryRun(props) {

  const nowRunning = 'scheduler/DryRun.jsx'

  const { updateErrorState } = props
  const defaultError = "The dry-run tool isn't working right now"
  const errorNumber = 61
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dryRunResults, setDryRunResults] = useState({})

  const dryRun = useCallback(async () => {

    const context = `${nowRunning}.dryRun`

    try {

      const api = 'scheduler/run'
      const payload = { dryRun: true }
      const { data } = await apiLoader({ api, payload })
      const {
        allCampaignsProcessedResults,
        failure,
        success
      } = data
      
      if (!success) {

        if (+level === 9) console.log(`failure: ${failure}`)

        toggleDimmer(false)
        updateErrorState({
          alreadyReported: false,
          context,
          errorNumber,
          message: `failure: ${failure}`,
          occurred: true
        })
        return null

      }

      setDryRunResults(allCampaignsProcessedResults)


    } catch(e) {

      if (+level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      updateErrorState({
        alreadyReported: false,
        details: e.message,
        context,
        errorNumber,
        message: defaultError,
        occurred: true
      })

    }

  }, [level, toggleDimmer, updateErrorState])

  const showCampaigns = () => {

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

  }

  useEffect(() => {

    const context = `${nowRunning}.useEffect`
    
    const runThis = async () => {

        try {

          if (!loading) {

              setLoading(true) // only do this once! 
              toggleDimmer(true)
              await dryRun() 
              setLoaded(true)       
              toggleDimmer(false)

          }

        } catch (e) {

        if (+level === 9) console.log(`exception: ${e.message}`)
    
        toggleDimmer(false)
        updateErrorState({
          alreadyReported: false,
          details: e.message,
          context,
          errorNumber,
          message: defaultError,
          occurred: true
        })
        setLoaded(true)
        
        }

      }

      runThis()

  }, [dryRun, level, loading, toggleDimmer, updateErrorState])

  try {
    
    // Final setup before rendering.

    console.log('dryRunResults', dryRunResults)
    const campaignsRun = Object.keys(dryRunResults).length
    let message = `${campaignsRun} campaign`

    if (campaignsRun !== 1) message += 's'

    message += ' were part of this dry run.'

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

   )

  } catch(e) {

    if (+level === 9) console.log(`exception: ${e.message}`)

    toggleDimmer(false)
    updateErrorState({
      alreadyReported: false,
      details: e.message,
      context: nowRunning,
      errorNumber,
      message: defaultError,
      occurred: true
    })

  }

}

export default DryRun;
import {
  useCallback,
  useEffect,
  useState
} from 'react';
import {
  useNavigate,
  useOutletContext,
  useParams
} from 'react-router-dom';
import { 
  Controller,
  useForm 
} from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import moment from 'moment';
import { toast } from 'react-toastify';
import { 
  Breadcrumb,
  Col,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { 
  List,
  PlusSquare
} from '@phosphor-icons/react';
import CheckBoxInput from '../common/CheckBoxInput';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import RequiredField from '../common/RequiredField';
import Selector from '../common/Selector';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import Warning from '../common/Warning';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';
const { intervals } = require('../../assets/json/static.json');

function EditCampaignComponent({ handleError }) {

  const nowRunning = 'EditCampaign.jsx';
  changeTitle('messagine: edit campaign');  
  
  const {
    level,
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const { campaignId } = useParams();

  const [state, setState] = useState({
    campaign: {},
    lists: {},
    loaded: false,
    renderKey: 0,
    showModal: false
  });

  const { 
    campaign,
    lists,
    loaded,
    renderKey,
    showModal 
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required(),
    campaignEnds: Joi.date().optional(),
    campaignInterval: Joi.number().required().integer().min(1).max(16),
    campaignName: Joi.string().required(),
    campaignNotes: Joi.string().optional().allow('', null),
    campaignRepeats: Joi.boolean().required(),
    campaignStarts: Joi.date().optional().when('campaignEnds', {
      is: Joi.exist(),
      then: Joi.date().required(),
      otherwise: Joi.forbidden()
    }),
    locked: Joi.boolean().required(),
    listId: Joi.string().optional().uuid().allow('', null),
    messageSeries: Joi.boolean().optional(),
    unsubUrl: Joi.string().required(),
  });

  const { 
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const navigate = useNavigate();

  const hideConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: false
    })); 

  };

  const loadCampaign = useCallback(async () => {

    const context = `${nowRunning}.loadCampaign`;
    const loadingMessage = 'loading the campaign record...';

    try {

      addLoadingMessage(loadingMessage);

      let api = 'campaigns/load';
      let payload = { campaignId };
      const { data } = await apiLoader({ api, payload });
      const {
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

      const campaign = { ...data };
      const {
        active,
        campaignName,
        campaignNotes,
        campaignRepeats,
        ends: campaignEnds,
        interval: campaignInterval,
        listId,
        locked,
        messageSeries,
        starts: campaignStarts,
        unsubUrl
      } = campaign;
      setValue('active', active);
      
      if (campaignEnds) { setValue('campaignEnds', moment.unix(campaignEnds).utc().toISOString()); }

      setValue('campaignInterval', campaignInterval);
      setValue('campaignName', campaignName);
      setValue('campaignNotes', campaignNotes);
      setValue('campaignRepeats', campaignRepeats);
      
      if (campaignStarts) { setValue('campaignStarts', moment.unix(campaignStarts).utc().toISOString()); }

      setValue('listId', listId);
      setValue('locked', locked > level);
      setValue('messageSeries', messageSeries);
      setValue('unsubUrl', unsubUrl);

      api = 'lists/all';
      payload = {};
      const { data: data2 } = await apiLoader({ api, payload });
      const {
        activeLists,
        failure: failure2,
        success: success2
      } = data2;

      if (!success2) {

        handleError({
          failure: failure2,
          nowRunning: context,
          userId
        });
        return null;

      }

      setState((prevState) => ({
        ...prevState,
        campaign,
        lists: activeLists,
        renderKey: prevState.renderKey + 1 // Force DatePicker to re-render.
      }));
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  }, [addLoadingMessage, campaignId, handleError, removeLoadingMessage, setValue, userId]);

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;
    const loadingMessage = 'deleting the campaign...';

    try {

      addLoadingMessage(loadingMessage);
      hideConfirmationModal();
      const api = 'campaigns/delete';
      const payload = { campaignId };
      const { data } = await apiLoader({ api, payload });
      const {
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

      removeLoadingMessage(loadingMessage);

      // Show success toast.

      toast.success('The campaign was deleted, and you were switched to the campaign list.');
      navigate('/campaigns/manage');

    } catch(e) {

      handleError({
        error: e,
        nowRunning: context,
        userId
      });

    }

  };

  const onChange = () => { trigger(); }

  const onReset = () => {

    reset();
    trigger();

  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'updating the campaign...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/update';
      const payload = { 
        ...data,
        campaignId,
      };
      data.campaignEnds = moment(data.campaignEnds).unix() || 0; // API compatibility
      data.campaignStarts = moment(data.campaignStarts).unix() || 0; // API compatibility
    
      const { data: result } = await apiLoader({ api, payload });
      const {
        failure,
        success
      } = result;

      if (!success) {

        handleError({
          error: failure,
          nowRunning: context,
          userId
        });
        return null;

      }

      toast.success('The campaign was updated.');
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  const showConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: !showModal
    }));
    
  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {
    
      if (!loaded) {

        try {

          await loadCampaign();

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

      trigger();

    };

    runThis();

  }, [handleError, loadCampaign, loaded, trigger, userId]);

  console.log(campaign);

  // if (Object.keys(errors).length > 0) { console.log(errors); }

  try {

    const disabled = +campaign.locked > +level;
    
    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the campaign record..." />)}

        {loaded && (
          
          <>

            {disabled && (<Warning message="This campaign is locked." />)}

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>campaigns</Breadcrumb.Item>
              <Breadcrumb.Item>edit</Breadcrumb.Item>
              <Breadcrumb.Item>{campaignId}</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      Show all campaigns
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="/campaigns/manage"><List /></a>
                  
                </OverlayTrigger>
                
              </div>

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      Create a new campaign
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="/campaigns/new"><PlusSquare /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              edit campaign

            </h5>

            <>

              <Form 
                className="bg-light p-3 mb-3"
                onSubmit={handleSubmit( onSubmit)}
              >

                <TextInput
                  defaultValue={campaign.campaignName}
                  disabled={disabled}
                  errors={errors.campaignName}
                  inputName="campaignName"
                  label="name"
                  onChange={ () => trigger() }
                  placeholder="new campaign name..."
                  register={register}
                />

                <Row>

                  <Col xs={12} sm={6}>
                    <Selector
                      disabled={disabled}
                      inputName="campaignInterval"
                      label="message interval"
                      onChange={onChange}
                      placeholder="please select an interval..."
                      register={register}
                      values={intervals}
                    />
                  </Col>

                  <Col xs={12} sm={6}>
                    <Selector
                      disabled={disabled}
                      inputName="listId"
                      label="contact list"
                      onChange={onChange}
                      placeholder="please select a set of contacts..."
                      register={register}
                      values={lists}
                    />
                  </Col>

                </Row>

                <div className="floats">

                  <div className="float-left mr-1">

                    <div className="size-65 text-muted mb-2">
                      campaign start
                      { " " }
                      {errors.date && (<RequiredField />) }
                    </div>
                    
                    <Controller
                      control={control}
                      name="campaignStarts"
                      render={({ field }) => (

                        <DatePicker
                          className="form-control mb-3 p-3 width-250px"
                          dateFormat="MMM d, yyyy h:mm aa"
                          disabled={disabled}
                          key={renderKey}
                          onChange={(date) => {
                            field.onChange(date);
                            trigger();
                          }}
                          placeholderText="select date..."
                          portalId="root-portal"
                          selected={field.value ? new Date(field.value) : null}  // Ensure valid Date or null
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={60}
                          timezone="America/Los_Angeles"
                        />
                        
                      )}

                    />

                  </div>

                  <div className="float-left mr-1">

                    <div className="size-65 text-muted mb-2 width-250px">
                      campaign ends
                      { " " }
                      {errors.date && (<RequiredField />) }
                    </div>
                    
                    <Controller
                      control={control}
                      name="campaignEnds"
                      render={({ field }) => (

                        <DatePicker
                          className="form-control mb-3 p-3 width-250px"
                          dateFormat="MMM d, yyyy h:mm aa"
                          disabled={disabled}
                          key={renderKey}
                          onChange={(date) => {
                            field.onChange(date);
                            trigger();
                          }}
                          placeholderText="select date..."
                          portalId="root-portal"
                          selected={field.value ? new Date(field.value) : null}  // Ensure valid Date or null
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={60}
                          timezone="America/Los_Angeles"
                        />

                      )}

                    />
                    
                  </div>

                </div>

                <div className="size-65 text-muted mb-3">options</div>

                <div className="floats">

                  <div className="float-left mr-1">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="active"
                      label="active"
                      register={register}
                    />

                  </div>

                  <div className="float-left mr-1">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="campaignRepeats"
                      label="repeats"
                      register={register}
                    />

                  </div>

                  <div className="float-left mr-1">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="messageSeries"
                      label="message series"
                      register={register}
                    />

                  </div>

                  <div className="float-left mr-1">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="locked"
                      label="locked"
                      register={register}
                    />

                  </div>

                </div>

                <TextInput
                  disabled={disabled}
                  errors={errors.unsubUrl}
                  inputName="unsubUrl"
                  label="unsubscribe link"
                  onChange={ () => trigger() }
                  placeholder="unsubscribe link required..."
                  register={register}
                />
                
                <TextArea
                  disabled={disabled}
                  inputName="campaignNotes"
                  label="notes"
                  placeholder="optional notes about the campaign..."
                  register={register}
                />

                {disabled !== true && (
                  <FormButtons
                    deletePrompt="remove this campaign"
                    errors={errors}
                    onReset={onReset}
                    showConfirmationModal={showConfirmationModal}
                    showDelete={true}
                    submitText="update campaign"
                  />
                )}

              </Form>

              <DeleteConfirmationModal 
                confirmModal={onDelete}
                hideModal={hideConfirmationModal}
                message="Are you sure you want to remove this campaign?"
                showConfirmationModal={showConfirmationModal} 
                showModal={showModal}
              />

            </>

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

export default function EditCampaign(props) {

  const defaultProps = {
    ...props,
    defaultError: "The campaign editor isn't working right now.",
    errorNumber: 67
  };

  return (

    <ErrorBoundary
      context="EditCampaign.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <EditCampaignComponent {...defaultProps} />
    </ErrorBoundary>

  );

}

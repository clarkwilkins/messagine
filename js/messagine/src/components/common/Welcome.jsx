import { changeTitle } from '../../services/utils';

function Welcome() {

  changeTitle( 'welcome to docr.js' );

  return (
        
    <div>
      
      <p>Welcome to <strong>docr.js</strong>. You will find the menu on the upper left corner.</p>

      <p><b>issues</b> is a discussions tool for documenting the development of your projects.</p>

      <p><b>components</b> documents and manages your <tt>React</tt> components.</p>

      <p><b>functions</b> documents and manages your <tt>React</tt> and API-side functions.</p>

      <p><b>routes</b> documents and manages your API routes.</p>

      <p><b>utilities:globals</b> manages globally used functions and parameters, such as error handling, that are used in many components, functions, or routes. If you are using the same value or function in more than one place (an output of <tt>useOutletContext()</tt> for example), you will want to declare it as a <tt>global</tt> once, and use it in many places.</p>

      <p><b>utilities:parameters</b> provides filterable lists of all global and standard parameters for reference.</p>

      <p><b>utilities:users</b> lets users with level 7+ create and manage user accounts.</p>

      <p><b>utilities:logout</b> closes your <b>docr.js</b> session.</p>

    </div>

  );

}

export default Welcome;
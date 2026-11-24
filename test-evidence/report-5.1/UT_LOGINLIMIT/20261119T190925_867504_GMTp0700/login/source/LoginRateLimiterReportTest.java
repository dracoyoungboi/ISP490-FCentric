package com.dev.backend.services.impl.utils;
import com.dev.backend.testsupport.MutableClock;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class LoginRateLimiterReportTest {
 static final Instant T0=Instant.parse("2026-11-19T00:00:00Z");
 static final class Scenario implements AutoCloseable {
  final MutableClock clock=new MutableClock(T0);
  final LoginRateLimiter limiter=new LoginRateLimiter(clock);
  boolean passed; int order;
  Scenario(String id,String expected){
   System.out.println("==================================================");
   System.out.println("Test Case ID: "+id);
   System.out.println("Test class: com.dev.backend.services.impl.utils.LoginRateLimiterReportTest");
   System.out.println("Test method: "+id);
   System.out.println("Step 1 - Prepare input: new LoginRateLimiter(new MutableClock(T0)); T0="+T0+"; identifier=user01; accountId=10; default IP=192.0.2.1");
   System.out.println("Step 2 - Execute: execute only the setup and action operations in the timeline; advance injected Clock, never sleep.");
   System.out.println("Expected specification: "+expected);
  }
  void at(long seconds){clock.advance(Duration.between(clock.instant(),T0.plusSeconds(seconds)));}
  LoginRateLimiter.Decision call(String stage,String identifier,String ip){
   LoginRateLimiter.Decision d=assertDoesNotThrow(()->limiter.tryAcquire(identifier,10,ip));
   assertNotNull(d);
   System.out.println("Timeline: {\"order\":"+(++order)+",\"offset\":"+Duration.between(T0,clock.instant()).getSeconds()+",\"clock\":\""+clock.instant()+"\",\"stage\":\""+stage+"\",\"operation\":\"tryAcquire\",\"identifier\":\""+identifier+"\",\"accountId\":10,\"ip\":"+(ip==null?"null":"\""+ip+"\"")+",\"allowed\":"+d.allowed()+",\"retryAfterSeconds\":"+d.retryAfterSeconds()+"}");
   return d;
  }
  void check(String stage,String identifier,String ip,boolean allowed,long wait){var d=call(stage,identifier,ip);assertAll(() -> assertEquals(allowed,d.allowed()), () -> assertEquals(wait,d.retryAfterSeconds()));}
  void setup(int count,String ip){for(int i=0;i<count;i++)check("setup","user01",ip,true,0);}
  void action(boolean allowed,long wait){check("action","user01","192.0.2.1",allowed,wait);}
  void success(){assertDoesNotThrow(()->limiter.recordSuccess("user01",10));System.out.println("Timeline: {\"order\":"+(++order)+",\"offset\":0,\"clock\":\""+clock.instant()+"\",\"stage\":\"action\",\"operation\":\"recordSuccess\",\"identifier\":\"user01\",\"accountId\":10,\"ip\":null,\"result\":\"void; no exception\"}");}
  void passed(){passed=true;}
  public void close(){System.out.println("Step 3 - Actual result: see exact returned values in Timeline entries; no additional calls.");System.out.println("Step 4 - Verify expected result: every setup allowed Decision checked for true/0; every action checks both allowed and retryAfterSeconds; recordSuccess checked for no exception plus confirmed postcondition.");System.out.println("Assertion result: "+(passed?"PASSED":"FAILED"));System.out.println("==================================================");}
 }
 @Test void UT_LOGINLIMIT_001(){try(var s=new Scenario("UT_LOGINLIMIT_001","true/0")){s.action(true,0);s.passed();}}
 @Test void UT_LOGINLIMIT_002(){try(var s=new Scenario("UT_LOGINLIMIT_002","true/0")){s.setup(4,"192.0.2.1");s.action(true,0);s.passed();}}
 @Test void UT_LOGINLIMIT_003(){try(var s=new Scenario("UT_LOGINLIMIT_003","false/50")){s.setup(5,"192.0.2.1");s.at(10);s.action(false,50);s.passed();}}
 @Test void UT_LOGINLIMIT_004(){try(var s=new Scenario("UT_LOGINLIMIT_004","true/0")){s.setup(5,"192.0.2.1");s.at(60);s.action(true,0);s.passed();}}
 @Test void UT_LOGINLIMIT_005(){try(var s=new Scenario("UT_LOGINLIMIT_005","true/0")){s.setup(5,"192.0.2.1");s.check("action","user01","192.0.2.2",true,0);s.passed();}}
 @Test void UT_LOGINLIMIT_006(){try(var s=new Scenario("UT_LOGINLIMIT_006","false/60")){s.setup(5,"192.0.2.1");s.check("action","user01@example.test","192.0.2.1",false,60);s.passed();}}
 @Test void UT_LOGINLIMIT_007(){try(var s=new Scenario("UT_LOGINLIMIT_007","false/60")){for(int i=1;i<=20;i++)s.check("setup","user01","192.0.2."+i,true,0);s.check("action","user01","192.0.2.100",false,60);s.passed();}}
 @Test void UT_LOGINLIMIT_008(){try(var s=new Scenario("UT_LOGINLIMIT_008","false/60")){s.setup(5,null);s.action(false,60);s.passed();}}
 @Test void UT_LOGINLIMIT_009(){try(var s=new Scenario("UT_LOGINLIMIT_009","false/290")){s.setup(5,"192.0.2.1");s.at(60);s.setup(5,"192.0.2.1");s.at(70);s.action(false,290);s.passed();}}
 @Test void UT_LOGINLIMIT_010(){try(var s=new Scenario("UT_LOGINLIMIT_010","true/0")){s.setup(5,"192.0.2.1");s.at(30);s.check("setup-blocked","user01","192.0.2.1",false,30);s.at(60);s.action(true,0);s.passed();}}
 @Test void UT_LOGINLIMIT_011(){try(var s=new Scenario("UT_LOGINLIMIT_011","two actions true/0; user supplemental conversation")){s.setup(4,"192.0.2.1");s.at(90);s.action(true,0);s.action(true,0);s.passed();}}
 @Test void UT_LOGINLIMIT_012(){try(var s=new Scenario("UT_LOGINLIMIT_012","false/60")){s.setup(5,"192.0.2.1");s.at(86400);s.setup(5,"192.0.2.1");s.action(false,60);s.passed();}}
 @Test void UT_LOGINLIMIT_013(){try(var s=new Scenario("UT_LOGINLIMIT_013","void/no exception, then true/0; user supplemental conversation")){s.setup(5,"192.0.2.1");s.success();s.action(true,0);s.passed();}}
}

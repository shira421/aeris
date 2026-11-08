package com.shira421.aeris;

import static org.junit.Assert.*;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.Context;
import android.content.ContextWrapper;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real OS scheduling: a missing ACCESS_NETWORK_STATE crashes this path on Android 14+. */
@RunWith(AndroidJUnit4.class)
public class FlightWatchTest {
    private Context context;
    @Before public void reset() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        FlightWatch.setItems(context, new JSONArray());
    }
    @After public void cleanup() { FlightWatch.setItems(context, new JSONArray()); }

    @Test public void alertsAndTripFlightsScheduleAndSurviveReload() throws Exception {
        for (boolean notify : new boolean[] {true, false}) {
            FlightWatch.setItems(context, new JSONArray("[{\"callsign\":\"SIA22\",\"notify\":" + notify + ",\"route\":null,\"state\":null}]"));
            assertEquals("SIA22", FlightWatch.items(context).getJSONObject(0).getString("callsign"));
            assertEquals(notify, FlightWatch.items(context).getJSONObject(0).getBoolean("notify"));
            JobInfo job = context.getSystemService(JobScheduler.class).getPendingJob(FlightWatch.JOB_ID);
            assertNotNull(job);
            assertTrue(job.isPersisted());
            assertEquals(JobInfo.NETWORK_TYPE_ANY, job.getNetworkType());
            FlightWatch.setItems(context, new JSONArray());
            assertNull(context.getSystemService(JobScheduler.class).getPendingJob(FlightWatch.JOB_ID));
            assertEquals(0, FlightWatch.items(context).length());
        }
    }

    @Test public void staleForegroundSaveKeepsNewerBackgroundState() throws Exception {
        FlightWatch.setItems(context, new JSONArray("[{\"callsign\":\"SIA22\",\"state\":{\"t\":200}}]"));
        FlightWatch.setItems(context, new JSONArray("[{\"callsign\":\"SIA22\",\"state\":{\"t\":100}}]"));
        assertEquals(200, FlightWatch.items(context).getJSONObject(0).getJSONObject("state").getInt("t"));
    }

    @Test public void unavailableSchedulerKeepsSavedFlightsForRetry() throws Exception {
        Context unavailable = new ContextWrapper(context) {
            @Override public Object getSystemService(String name) {
                return Context.JOB_SCHEDULER_SERVICE.equals(name) ? null : super.getSystemService(name);
            }
        };
        try {
            FlightWatch.setItems(unavailable, new JSONArray("[{\"callsign\":\"SIA22\",\"state\":null}]"));
            fail("Unavailable scheduler must be reported");
        } catch (IllegalStateException expected) {
            assertEquals(1, FlightWatch.items(context).length());
        }
    }
}

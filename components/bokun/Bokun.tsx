// components/BokunButton.js
'use client'

import React, { useEffect } from 'react'
import Button from '../button/Button'

const BokunButton = () => {
  useEffect(() => {
    // Dynamically load the Bokun widget script
    const script = document.createElement('script')
    script.src =
      'https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=1a87159d-0e31-4359-a404-34d39230f549'
    script.async = true
    document.body.appendChild(script)

    // Clean up script when the component unmounts
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <Button
      className='bokunButton'
      id='bokun_fedc26ce_b25f_4b4f_a9aa_36933b9b279c'
      data-src='https://widgets.bokun.io/online-sales/1a87159d-0e31-4359-a404-34d39230f549/experience/914476?partialView=1'
      data-testid='widget-book-button'
      onMouseEnter={(e) =>
        ((e.target as HTMLButtonElement).style.background = '#285726')
      }
      onMouseLeave={(e) =>
        ((e.target as HTMLButtonElement).style.background = '#408C3D')
      }
      onMouseDown={(e) =>
        ((e.target as HTMLButtonElement).style.background = '#30682e')
      }
      onMouseUp={(e) =>
        ((e.target as HTMLButtonElement).style.background = '#285726')
      }
    >
      Book now
    </Button>
  )
}

export default BokunButton
